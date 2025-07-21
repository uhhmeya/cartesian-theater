from flask import Blueprint, request, jsonify, session
from flask_socketio import emit, disconnect
from datetime import datetime, timedelta
from src.misc import User, socketio, db, bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from threading import Timer

auth = Blueprint('auth', __name__)

#public
@auth.route('/signin', methods=['POST'])
def signin():
    data = request.get_json()
    username = data.get('user', '').strip().lower()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({"success": False, "message": "Both username and password are required"}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({"success": False, "message": "Bad credentials"}), 401

    return jsonify({
        "success": True,
        "access_token": create_access_token(identity=str(user.id)),
        "refresh_token": create_refresh_token(identity=str(user.id))
    }), 200

#public
@auth.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('user', '').strip().lower()
    password = data.get('password', '')

    if not username or not password or len(username) < 4 or len(password) < 8:
        return jsonify({"success": False, "message": "Username min 4 chars, password min 8 chars"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"success": False, "message": "Username already exists"}), 409

    user = User(username=username, password_hash=bcrypt.generate_password_hash(password).decode('utf-8'))
    db.session.add(user)
    db.session.commit()

    return jsonify({"success": True}), 201

#public
@auth.route('/refresh', methods=['POST'])
def refresh():
    refresh_token = request.get_json().get('refresh_token')
    if not refresh_token:
        return jsonify({"success": False, "message": "Refresh token is required"}), 400

    try:
        user_id = decode_token(refresh_token)['sub']
        return jsonify({
            "success": True,
            "access_token": create_access_token(identity=str(user_id))
        }), 200
    except:
        return jsonify({"success": False, "message": "Invalid or expired refresh token"}), 401

@socketio.on('connect')
def handle_connect():
    access_token = request.args.get('token')
    if not access_token:
        disconnect()
        return False

    try:
        decoded = decode_token(access_token)
        user_id = int(decoded['sub'])
        user = User.query.get(user_id)
        if not user:
            disconnect()
            return False

        session['user_id'] = user_id
        session['username'] = user.username

        emit('connection_response', {
            'status': 'connected',
            'username': user.username
        })
        return True
    except:
        disconnect()
        return False

@socketio.on('disconnect')
def handle_disconnect():
    pass

@socketio.on('message')
def handle_message(data):
    text = data.get('text')
    username = session.get('username')

    emit('message', {
        'user': username,
        'text': text,
        'timestamp': datetime.utcnow().isoformat()
    }, broadcast=True, include_self=False)

    def send_erik_response():
        emit('message', {
            'user': 'erik_ai',
            'text': 'Hi',
            'timestamp': datetime.utcnow().isoformat()
        }, broadcast=True)

    Timer(2.0, send_erik_response).start()