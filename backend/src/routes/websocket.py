from flask import request, session
from flask_socketio import emit, disconnect
from datetime import datetime
from extensions import socketio, db
from src.models import User, Message
from src.routes.utility import verify_access_token

active_connections = {}

def deliver_queued_messages(user):
    queued_messages = Message.query.filter_by(recipient_id=user.id).order_by(Message.created_at).all()

    if not queued_messages:
        print(f"[{datetime.utcnow().isoformat()}] No queued messages for {user.username}")
        return

    user_sid = active_connections.get(user.id)

    for msg in queued_messages:
        print(f"[{datetime.utcnow().isoformat()}] Sending queued message: {msg.sender.username} -> {msg.recipient.username} (ID: {msg.message_id})")
        socketio.emit('message', {
            'sender': msg.sender.username,
            'receiver': msg.recipient.username,
            'text': msg.text,
            'time': msg.created_at.isoformat(),
            'id': msg.message_id
        }, room=user_sid)

    for msg in queued_messages:
        db.session.delete(msg)

    db.session.commit()

@socketio.on('connect')
def handle_connect(auth):
    token = request.args.get('token')
    user = verify_access_token(token)

    if not user:
        print(f"[{datetime.utcnow().isoformat()}] WebSocket connection rejected, bad token")
        disconnect()
        return False

    old_sid = active_connections.get(user.id)
    if old_sid and old_sid != request.sid:
        socketio.server.disconnect(old_sid)

    session['user_id'] = user.id
    session['username'] = user.username
    active_connections[user.id] = request.sid


    emit('connection_response', {
        'status': 'connected',
        'username': user.username})

    socketio.emit('social_update')
    socketio.sleep(0.1)
    deliver_queued_messages(user)

    return True

@socketio.on('disconnect')
def handle_disconnect():
    user_id = session.get('user_id')
    username = session.get('username', 'unknown')
    if user_id and user_id in active_connections:
        del active_connections[user_id]
        print(f"[{datetime.utcnow().isoformat()}] 🔌 {username} disconnected")
        socketio.emit('social_update')

@socketio.on('message')
def handle_message(data):
    text = data.get('text')
    recipient = data.get('recipient')
    message_id = data.get('id')
    sender_id = session.get('user_id')

    print(f"[{datetime.utcnow().isoformat()}] [{session['username']} -> {recipient} ({len(text)} chars)")

    recipient_user = User.query.filter_by(username=recipient).first()

    emit('status_update', {
        'messageId': message_id,
        'status': 'delivered'
    })

    if recipient_user.id in active_connections:
        target_room = active_connections[recipient_user.id]
        socketio.emit('message', {
            'sender': session['username'],
            'receiver': recipient,
            'text': text,
            'time': datetime.utcnow().isoformat(),
            'id': message_id
        }, room=target_room)
    else:
        print(f"[{datetime.utcnow().isoformat()}] {session['username']} -> {recipient} (queued)")
        message = Message(
            sender_id=sender_id,
            recipient_id=recipient_user.id,
            message_id=message_id,
            text=text)

        db.session.add(message)
        db.session.commit()