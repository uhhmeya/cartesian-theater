from flask import request, session
from flask_socketio import emit, disconnect
from datetime import datetime
from extensions import socketio
from src.models import User
from src.utils.auth import verify_access_token
from threading import Timer

active_connections = {}

@socketio.on('connect')
def handle_connect():
    token = request.args.get('token')
    user = verify_access_token(token)

    if not user:
        disconnect()
        return False

    # prevents duplicate socket connections
    old_sid = active_connections.get(user.id)
    if old_sid and old_sid != request.sid:
        socketio.server.disconnect(old_sid)

    session['user_id'] = user.id
    session['username'] = user.username
    active_connections[user.id] = request.sid

    emit('connection_response', {
        'status': 'connected',
        'username': user.username})

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

@socketio.on('message')
def handle_message(data):
    text = data.get('text')
    recipient = data.get('recipient')

    if not text or not recipient:
        emit('error', {'message': 'Missing text or recipient'})
        return

    if recipient == 'erik':
        emit('message', {
            'sender': 'erik',
            'receiver': session['username'],
            'text': 'Hi',
            'time': datetime.utcnow().isoformat()
        })
        return

    recipient_user = User.query.filter_by(username=recipient).first()
    if not recipient_user:
        emit('error', {'message': 'User not found'})
        return

    if recipient_user.id not in active_connections:
        emit('error', {'message': 'User offline'})
        return

    socketio.emit('message', {
        'sender': session['username'],
        'receiver': recipient,
        'text': text,
        'time': datetime.utcnow().isoformat()
    }, room=active_connections[recipient_user.id])