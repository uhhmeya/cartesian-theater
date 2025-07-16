from flask import Blueprint, request, jsonify
from flask_socketio import emit, disconnect
from src.misc import User, socketio
from src.utility import extractRefreshToken, validateRefreshToken, createNewAccessToken, verifyAccessToken, displayUsers, checkCredentials, checkFormat, addUser, extractAccessTokenFromWebSocket, validateAccessToken


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
    print(f"Client connection attempt: {request.sid}")

    access_token, error_response, status_code = extractAccessTokenFromWebSocket()
    if access_token is None:
        print(f"Connection rejected - No token provided for {request.sid}")
        # Instead of returning False, disconnect the client properly
        disconnect()
        return

    print(f"Token extracted, calling validateAccessToken...")

    user_data, error_response, status_code = validateAccessToken(access_token)
    if user_data is None:
        print(f"Connection rejected - Token validation failed for {request.sid}")
        # Instead of returning False, disconnect the client properly
        disconnect()
        return

    print(f"Client authenticated: {request.sid} (User: {user_data['username']})")

    emit('connection_response', {
        'message': 'Welcome to Cartesian Theater!',
        'session_id': request.sid,
        'user_id': user_data['user_id'],
        'username': user_data['username'],
        'status': 'connected'
    })



@socketio.on('disconnect')
def handle_disconnect():
    print(f" Client disconnected: {request.sid}")


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