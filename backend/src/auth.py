from flask import Blueprint, request, jsonify, session
from flask_socketio import emit, disconnect
from datetime import datetime, timedelta
from extensions import User, socketio, db, bcrypt, FriendRequest
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from src.utility import verify_access_token, login_required
from threading import Timer

auth = Blueprint('auth', __name__)

#http public
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

#http public
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

#http public
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

#websocket protected : called when server auto accepts websocket connection
@socketio.on('connect')
def handle_connect():
    token = request.args.get('token')
    user = verify_access_token(token)

    if not user:
        disconnect()
        return False

    session['user_id'] = user.id
    session['username'] = user.username
    sid = request.sid

    emit('connection_response', {
        'status': 'connected',
        'username': user.username})

    def send_greeting():
        socketio.emit('message', {
            'user': 'erik_ai',
            'text': 'Hi?',
            'timestamp': datetime.utcnow().isoformat()}, to=sid)

    Timer(0.5, send_greeting).start()

    return True

#websocket protected : called when frontend sends data through websocket with 'disconnect' title
@socketio.on('disconnect')
def handle_disconnect():
    pass

#websocket protected : called when frontend sends data through websocket with 'message' title
@socketio.on('message')
def handle_message(data):
    text = data.get('text')

    emit('message', {
        'user': 'erik_ai',
        'text': 'Hi',
        'timestamp': datetime.utcnow().isoformat()
    })

#http protected : gets all users except yourself and their friend request status
@auth.route('/users', methods=['GET'])
@login_required
def get_all_users(user):

    users = User.query.filter(User.id != user.id).all()

    sent_requests = FriendRequest.query.filter_by(sender_id=user.id).all()
    request_status = {req.receiver_id: req.status for req in sent_requests}

    user_list = []
    for u in users:
        status = request_status.get(u.id, 'none')
        if status == 'accepted': continue
        user_list.append({'id': u.id,'username': u.username,'status': status})

    return jsonify({'success': True, 'users': user_list}), 200


@auth.route('/friend-request', methods=['POST'])
@login_required
def send_friend_request(user):

    receiver_id = request.get_json().get('receiver_id')

    if user.id == receiver_id:
        return jsonify({'success': False, 'message': 'Cannot send request to yourself'}), 400

    #checks if friend request already exists
    existing = FriendRequest.query.filter_by(
        sender_id=user.id,
        receiver_id=receiver_id,
        status='pending').first()

    if existing:
        return jsonify({'success': False, 'message': 'Request already sent'}), 400

    friend_request = FriendRequest(sender_id=user.id, receiver_id=receiver_id)
    db.session.add(friend_request)
    db.session.commit()

    return jsonify({'success': True}), 201


@auth.route('/friend-requests/outgoing', methods=['GET'])
@login_required
def get_outgoing_requests(user):
    requests = FriendRequest.query.filter_by(sender_id=user.id, status='pending').all()
    return jsonify([{'id': r.id, 'username': r.receiver.username} for r in requests])

@auth.route('/friend-requests/incoming', methods=['GET'])
@login_required
def get_incoming_requests(user):
    requests = FriendRequest.query.filter_by(receiver_id=user.id, status='pending').all()
    return jsonify([{'id': r.id, 'username': r.sender.username} for r in requests])


