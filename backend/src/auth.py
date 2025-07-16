from flask import Blueprint, request, jsonify
from flask_socketio import emit
from src.misc import User, socketio
from src.utility import extractRefreshToken, validateRefreshToken, createNewAccessToken, verifyAccessToken, displayUsers, checkCredentials, checkFormat, addUser


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
def handle_connect():
    print(f"🔌 Client connected: {request.sid}")
    emit('connection_response', {
        'message': 'Welcome to Cartesian Theater!',
        'session_id': request.sid,
        'status': 'connected'
    })

@socketio.on('disconnect')
def handle_disconnect():
    print(f"🔌 Client disconnected: {request.sid}")


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
