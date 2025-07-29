from flask import Blueprint, request, jsonify
from extensions import db
from src.models import User, FriendRequest
from src.models.message import Message
from src.utils.auth import login_required

social = Blueprint('social', __name__)

@social.route('/social-data', methods=['GET'])
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

@social.route('/friend-request', methods=['POST'])
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

@social.route('/friend-request/<int:request_id>/accept', methods=['POST'])
@login_required
def accept_friend_request(user, request_id):
    friend_request = FriendRequest.query.get(request_id)

    if not friend_request or friend_request.receiver_id != user.id:
        return jsonify({'success': False}), 404

    friend_request.status = 'accepted'
    db.session.commit()

    return jsonify({'success': True}), 200

@social.route('/friend-request/<int:request_id>/reject', methods=['POST'])
@login_required
def reject_friend_request(user, request_id):
    friend_request = FriendRequest.query.get(request_id)

    if not friend_request or friend_request.receiver_id != user.id:
        return jsonify({'success': False}), 404

    friend_request.status = 'rejected'
    db.session.commit()

    return jsonify({'success': True}), 200

@social.route('/friend-request/<int:request_id>/cancel', methods=['DELETE'])
@login_required
def cancel_friend_request(user, request_id):
    friend_request = FriendRequest.query.get(request_id)

    if not friend_request or friend_request.sender_id != user.id:
        return jsonify({'success': False}), 404

    db.session.delete(friend_request)
    db.session.commit()

    return jsonify({'success': True}), 200

#gets user's older messages
@social.route('/conversation/<username>', methods=['GET'])
@login_required
def get_conversation(user, username):
    print(f"=== GET CONVERSATION DEBUG ===")
    print(f"Headers: {dict(request.headers)}")
    print(f"Auth header: {request.headers.get('Authorization')}")
    print(f"User param: {user}")
    print(f"Username param: {username}")
    other_user = User.query.filter_by(username=username).first()
    if not other_user:
        return jsonify({'success': False}), 404

    messages = Message.query.filter(
        ((Message.sender_id == user.id) & (Message.receiver_id == other_user.id)) |
        ((Message.sender_id == other_user.id) & (Message.receiver_id == user.id))
    ).order_by(Message.created_at).all()

    return jsonify({
        'success': True,
        'messages': [{
            'sender': msg.sender.username,
            'receiver': msg.receiver.username,
            'text': msg.text,
            'time': msg.created_at.isoformat()
        } for msg in messages]
    })