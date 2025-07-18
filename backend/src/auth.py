from flask import Blueprint, request, jsonify, session
from flask_socketio import emit, disconnect, join_room, leave_room
from datetime import datetime
from src.misc import User, socketio
from src.utility import (
    extractRefreshToken, validateRefreshToken, createNewAccessToken,
    verifyAccessToken, displayUsers, checkCredentials, checkFormat,
    addUser, extractAccessTokenFromWebSocket, validateAccessToken,
    handle_websocket_message, handle_user_typing, handle_add_reaction,
    handle_user_online, handle_user_disconnect
)

auth = Blueprint('auth', __name__)

@auth.route('/signin', methods=['POST'])
def signin():
    data = request.get_json()
    username = data.get('user')
    password = data.get('password')
    return checkCredentials(username, password)

@auth.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('user')
    password = data.get('password')

    format_response = checkFormat(username, password)
    if format_response[1] != 201:
        return format_response

    return addUser(username, password)

@auth.route('/refresh', methods=['POST'])
def refresh():
    refresh_token, error_response, status_code = extractRefreshToken()
    if refresh_token is None:
        return error_response, status_code

    user_id, error_response, status_code = validateRefreshToken(refresh_token)
    if user_id is None:
        return error_response, status_code

    new_access_token, error_response, status_code = createNewAccessToken(user_id)
    if new_access_token is None:
        return error_response, status_code

    return jsonify({
        "message": "Token refreshed successfully",
        "success": True,
        "access_token": new_access_token
    }), 200

@socketio.on('connect')
def handle_connect(auth=None):
    access_token, error_response, status_code = extractAccessTokenFromWebSocket()
    if access_token is None:
        disconnect()
        return False

    user_data, error_response, status_code = validateAccessToken(access_token)
    if user_data is None:
        disconnect()
        return False

    session['user_id'] = user_data['user_id']
    session['username'] = user_data['username']

    emit('connection_response', {
        'message': 'Welcome to Cartesian Theater!',
        'session_id': request.sid,
        'user_id': user_data['user_id'],
        'username': user_data['username'],
        'status': 'connected'
    })

    return True

@socketio.on('disconnect')
def handle_disconnect():
    handle_user_disconnect(session)

@socketio.on('message')
def handle_message(data):
    handle_websocket_message(session, data)

@socketio.on('typing')
def handle_typing(data):
    handle_user_typing(session, data)

@socketio.on('add_reaction')
def handle_reaction(data):
    handle_add_reaction(session, data)

@socketio.on('user_online')
def handle_online():
    handle_user_online(session)

@socketio.on('join_channel')
def handle_join_channel(data):
    channel_id = data.get('channel_id')
    username = session.get('username')
    join_room(channel_id)
    emit('joined_channel', {'channel_id': channel_id})

    emit('message', {
        'id': f'system-{request.sid}-{channel_id}',
        'channel_id': channel_id,
        'user': 'System',
        'text': f'{username} has joined the channel',
        'timestamp': datetime.utcnow().isoformat(),
        'isSystem': True
    }, room=channel_id, include_self=False)

@socketio.on('leave_channel')
def handle_leave_channel(data):
    channel_id = data.get('channel_id')
    username = session.get('username')

    emit('message', {
        'id': f'system-{request.sid}-{channel_id}-leave',
        'channel_id': channel_id,
        'user': 'System',
        'text': f'{username} has left the channel',
        'timestamp': datetime.utcnow().isoformat(),
        'isSystem': True
    }, room=channel_id, include_self=False)

    leave_room(channel_id)
    emit('left_channel', {'channel_id': channel_id})

@auth.route('/debug/users', methods=['GET'])
def list_users():
    user_data, error_response, status_code = displayUsers()
    if user_data is None:
        return error_response, status_code

    return jsonify({
        "message": "User data retrieved successfully",
        "success": True,
        "data": user_data
    }), 200

@auth.route('/messages/<channel_id>', methods=['GET'])
def get_messages(channel_id):
    from src.utility import login_required, get_chat_messages

    @login_required
    def _get_messages(user):
        return get_chat_messages(user, channel_id)

    return _get_messages()