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
    username = data.get('user', '').strip()
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
    username = data.get('user', '').strip()
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

active_connections = {}

@socketio.on('connect')
def handle_connect():
    token = request.args.get('token')
    user = verify_access_token(token)

    if not user:
        disconnect()
        return False

    session['user_id'] = user.id
    session['username'] = user.username
    active_connections[user.id] = request.sid

    emit('connection_response', {
        'status': 'connected',
        'username': user.username})

    def send_greeting():
        socketio.emit('message', {
            'sender': 'erik',
            'receiver': user.username,
            'text': 'Hi?',
            'time': datetime.utcnow().isoformat()
        }, to=request.sid)

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

    if recipient == 'erik':
        emit('message', {
            'sender': 'erik',
            'receiver': session['username'],
            'text': 'Hi',
            'time': datetime.utcnow().isoformat()
        })
        return

    recipient_user = User.query.filter_by(username=recipient).first()
    if recipient_user and recipient_user.id in active_connections:
        socketio.emit('message', {
            'sender': session['username'],
            'receiver': recipient,
            'text': text,
            'time': datetime.utcnow().isoformat()
        }, room=active_connections[recipient_user.id])

@auth.route('/social-data', methods=['GET'])
@login_required
def get_social_data(user):
    users = User.query.filter(User.id != user.id).all()

    sent_requests = FriendRequest.query.filter_by(sender_id=user.id).all()
    received_requests = FriendRequest.query.filter_by(receiver_id=user.id).all()

    request_map = {}
    for req in sent_requests:
        request_map[req.receiver_id] = {'status': req.status, 'id': req.id, 'type': 'sent'}
    for req in received_requests:
        if req.sender_id not in request_map:
            request_map[req.sender_id] = {'status': req.status, 'id': req.id, 'type': 'received'}

    def get_relationship_status(status, request_type):
        if status == 'accepted':
            return 'we_are_friends'
        elif status == 'pending' and request_type == 'sent':
            return 'i_sent_them_a_request'
        elif status == 'pending' and request_type == 'received':
            return 'they_sent_me_a_request'
        elif status == 'rejected' and request_type == 'sent':
            return 'they_rejected_me'
        elif status == 'rejected' and request_type == 'received':
            return 'i_rejected_them'
        else:
            return 'no_request_exists'

    user_list = [{
        'id': u.id,
        'username': u.username,
        'relationshipStatus': get_relationship_status(
            request_map.get(u.id, {}).get('status', 'none'),
            request_map.get(u.id, {}).get('type', 'none')
        ),
        'requestId': request_map.get(u.id, {}).get('id')
    } for u in users]

    # Add erik as a friend
    user_list.append({
        'id': 'erik',
        'username': 'erik',
        'relationshipStatus': 'we_are_friends',
        'requestId': None
    })

    return jsonify({
        'success': True,
        'users': user_list
    }), 200


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


@auth.route('/friend-request/<int:request_id>/accept', methods=['POST'])
@login_required
def accept_friend_request(user, request_id):
    friend_request = FriendRequest.query.get(request_id)

    if not friend_request or friend_request.receiver_id != user.id:
        return jsonify({'success': False}), 404

    friend_request.status = 'accepted'
    db.session.commit()

    return jsonify({'success': True}), 200

@auth.route('/friend-request/<int:request_id>/reject', methods=['POST'])
@login_required
def reject_friend_request(user, request_id):
    friend_request = FriendRequest.query.get(request_id)

    if not friend_request or friend_request.receiver_id != user.id:
        return jsonify({'success': False}), 404

    friend_request.status = 'rejected'
    db.session.commit()

    return jsonify({'success': True}), 200


@auth.route('/friend-request/<int:request_id>/cancel', methods=['DELETE'])
@login_required
def cancel_friend_request(user, request_id):
    friend_request = FriendRequest.query.get(request_id)

    if not friend_request or friend_request.sender_id != user.id:
        return jsonify({'success': False}), 404

    db.session.delete(friend_request)
    db.session.commit()

    return jsonify({'success': True}), 200