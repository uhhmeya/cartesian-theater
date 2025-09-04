from flask import request, session
from flask_socketio import emit, disconnect
from datetime import datetime
from extensions import socketio, db
from src.models import User, Message
from src.routes.utility import verify_access_token
from threading import Timer

active_connections = {}

def deliver_queued_messages(user_id):

    # deliver queued messages in order when user comes online
    queued_messages = Message.query.filter_by(recipient_id=user_id).order_by(Message.created_at).all()

    if not queued_messages:
        return

    user_sid = active_connections.get(user_id)
    if not user_sid:
        return

    for msg in queued_messages:
        socketio.emit('message', {
            'sender': msg.sender.username,
            'receiver': msg.recipient.username,
            'text': msg.text,
            'time': msg.created_at.isoformat(),
            'id': msg.message_id
        }, room=user_sid)

    # delete all delivered messages from DB
    for msg in queued_messages:
        db.session.delete(msg)

    db.session.commit()

@socketio.on('connect')
def handle_connect(auth):
    token = request.args.get('token')
    user = verify_access_token(token)

    if not user:
        print("websocket connection rejected, bad token")
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

    deliver_queued_messages(user.id)

    sid = request.sid
    def send_greeting():
        socketio.emit('message', {
            'sender': 'erik',
            'receiver': user.username,
            'text': 'Hi?',
            'time': datetime.utcnow().isoformat()
        }, to=sid)

    Timer(0.5, send_greeting).start()

    return True

@socketio.on('disconnect')
def handle_disconnect():
    user_id = session.get('user_id')
    if user_id and user_id in active_connections:
        del active_connections[user_id]
        socketio.emit('social_update')

@socketio.on('message')
def handle_message(data):
    text = data.get('text')
    recipient = data.get('recipient')
    message_id = data.get('id')
    sender_id = session.get('user_id')

    print(f"[MSG] {session['username']} -> {recipient}: {text}")

    if recipient == 'erik':
        emit('message', {
            'sender': 'erik',
            'receiver': session['username'],
            'text': 'Hi',
            'time': datetime.utcnow().isoformat()
        })

        emit('status_update', {
            'messageId': message_id,
            'status': 'delivered'
        })
        return

    recipient_user = User.query.filter_by(username=recipient).first()

    if not recipient_user:
        emit('status_update', {
            'messageId': message_id,
            'status': 'failed'
        })
        return

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


        message = Message(
            sender_id=sender_id,
            recipient_id=recipient_user.id,
            message_id=message_id,
            text=text)

        db.session.add(message)
        db.session.commit()