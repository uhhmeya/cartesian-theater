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
import logging

logger = logging.getLogger(__name__)

auth = Blueprint('auth', __name__)

@auth.route('/signin', methods=['POST'])
def signin():
    logger.info("🔐 Sign-in attempt started")
    data = request.get_json()
    username = data.get('user')
    password = data.get('password')

    logger.debug(f"   Username: {username}")
    logger.debug(f"   Password: {'*' * len(password) if password else 'None'}")

    result = checkCredentials(username, password)
    logger.info(f"   Sign-in result: {result[1]} - {result[0].get_json()['message'] if hasattr(result[0], 'get_json') else result[0]['message']}")
    return result

@auth.route('/signup', methods=['POST'])
def signup():
    logger.info("📝 Sign-up attempt started")
    data = request.get_json()
    username = data.get('user')
    password = data.get('password')

    logger.debug(f"   Username: {username}")

    format_response = checkFormat(username, password)
    if format_response[1] != 201:
        logger.warning(f"   Format check failed: {format_response[0].get_json()['message']}")
        return format_response

    result = addUser(username, password)
    logger.info(f"   Sign-up result: {result[1]} - {result[0].get_json()['message'] if hasattr(result[0], 'get_json') else result[0]['message']}")
    return result

@auth.route('/refresh', methods=['POST'])
def refresh():
    logger.info("🔄 Token refresh attempt")

    refresh_token, error_response, status_code = extractRefreshToken()
    if refresh_token is None:
        logger.warning("   No refresh token found")
        return error_response, status_code

    logger.debug(f"   Refresh token: {refresh_token[:20]}...")

    user_id, error_response, status_code = validateRefreshToken(refresh_token)
    if user_id is None:
        logger.warning("   Invalid refresh token")
        return error_response, status_code

    logger.debug(f"   User ID from token: {user_id}")

    new_access_token, error_response, status_code = createNewAccessToken(user_id)
    if new_access_token is None:
        logger.error("   Failed to create new access token")
        return error_response, status_code

    logger.info("✅ Token refreshed successfully")
    return jsonify({
        "message": "Token refreshed successfully",
        "success": True,
        "access_token": new_access_token
    }), 200

@socketio.on('connect')
def handle_connect(auth=None):
    logger.info(f"🔌 WebSocket connection attempt from {request.sid}")

    access_token, error_response, status_code = extractAccessTokenFromWebSocket()
    if access_token is None:
        logger.warning(f"   No access token in WebSocket connection")
        disconnect()
        return False

    logger.debug(f"   Access token: {access_token[:20]}...")

    user_data, error_response, status_code = validateAccessToken(access_token)
    if user_data is None:
        logger.warning(f"   Invalid access token for WebSocket")
        disconnect()
        return False

    session['user_id'] = user_data['user_id']
    session['username'] = user_data['username']

    logger.info(f"✅ WebSocket connected: User {user_data['username']} (ID: {user_data['user_id']})")

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
    user_id = session.get('user_id')
    username = session.get('username')
    logger.info(f"🔌 WebSocket disconnected: User {username} (ID: {user_id})")
    handle_user_disconnect(session)

@socketio.on('message')
def handle_message(data):
    logger.debug(f"💬 Message received from {session.get('username')}: {data}")
    handle_websocket_message(session, data)

@socketio.on('typing')
def handle_typing(data):
    logger.debug(f"⌨️  Typing indicator from {session.get('username')}: {data}")
    handle_user_typing(session, data)

@socketio.on('add_reaction')
def handle_reaction(data):
    logger.debug(f"😀 Reaction added by {session.get('username')}: {data}")
    handle_add_reaction(session, data)

@socketio.on('user_online')
def handle_online():
    logger.debug(f"🟢 User online: {session.get('username')}")
    handle_user_online(session)

@socketio.on('join_channel')
def handle_join_channel(data):
    channel_id = data.get('channel_id')
    username = session.get('username')
    logger.info(f"➕ User {username} joining channel: {channel_id}")
    join_room(channel_id)
    emit('joined_channel', {'channel_id': channel_id})

    logger.debug(f"   Sending join notification to channel: {channel_id}")
    emit('message', {
        'id': f'system-{request.sid}-{channel_id}',
        'channel_id': channel_id,
        'user': 'System',
        'text': f'{username} has joined the channel',
        'time': datetime.now().strftime('%I:%M %p').lstrip('0'),
        'timestamp': datetime.utcnow().isoformat(),
        'isSystem': True
    }, room=channel_id, include_self=False)

@socketio.on('leave_channel')
def handle_leave_channel(data):
    channel_id = data.get('channel_id')
    username = session.get('username')
    logger.info(f"➖ User {username} leaving channel: {channel_id}")

    logger.debug(f"   Sending leave notification to channel: {channel_id}")
    emit('message', {
        'id': f'system-{request.sid}-{channel_id}-leave',
        'channel_id': channel_id,
        'user': 'System',
        'text': f'{username} has left the channel',
        'time': datetime.now().strftime('%I:%M %p').lstrip('0'),
        'timestamp': datetime.utcnow().isoformat(),
        'isSystem': True
    }, room=channel_id, include_self=False)

    leave_room(channel_id)
    emit('left_channel', {'channel_id': channel_id})

@auth.route('/debug/users', methods=['GET'])
def list_users():
    logger.debug("📋 Listing all users")

    user_data, error_response, status_code = displayUsers()
    if user_data is None:
        logger.error("   Failed to retrieve users")
        return error_response, status_code

    logger.debug(f"   Found {user_data['total_users']} users")
    return jsonify({
        "message": "User data retrieved successfully",
        "success": True,
        "data": user_data
    }), 200