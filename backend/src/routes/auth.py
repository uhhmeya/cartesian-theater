from flask import Blueprint, request, jsonify
from extensions import db, bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from src.models import User
from src.models.root_key_setup import RootKeySetup
from src.routes.utility import login_required

auth = Blueprint('auth', __name__)

@auth.route('/signin', methods=['POST'])
def signin():
    data = request.get_json()
    username = data.get('user', '').strip()
    password = data.get('password', '')

    if not username or not password:
        print(f"[SIGNIN FAILED] Missing credentials - username: '{username}', password: {'***' if password else 'empty'}")
        return jsonify({"success": False, "message": "Both username and password are required"}), 400

    user = User.query.filter_by(username=username).first()

    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        print(f"[SIGNIN FAILED] Bad credentials for: {username}")
        return jsonify({"success": False, "message": "Bad credentials"}), 401

    return jsonify({
        "success": True,
        "access_token": create_access_token(identity=str(user.id)),
        "refresh_token": create_refresh_token(identity=str(user.id))
    }), 200

@auth.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('user', '').strip()
    password = data.get('password', '')

    if not username or not password or len(username) < 4 or len(password) < 8:
        print(f"[SIGNUP FAILED] Invalid input - username: '{username}' ({len(username)} chars), password: {'***' if password else 'empty'} ({len(password)} chars)")
        return jsonify({"success": False, "message": "Username min 4 chars, password min 8 chars"}), 400

    if User.query.filter_by(username=username).first():
        print(f"[SIGNUP FAILED] Username '{username}' already exists")
        return jsonify({"success": False, "message": "Username already exists"}), 409

    user = User(username=username, password_hash=bcrypt.generate_password_hash(password).decode('utf-8'))
    db.session.add(user)
    db.session.commit()

    return jsonify({"success": True}), 201

@auth.route('/refresh', methods=['POST'])
def refresh():
    refresh_token = request.get_json().get('refresh_token')
    if not refresh_token:
        print("[REFRESH FAILED] No refresh token provided")
        return jsonify({"success": False, "message": "Refresh token is required"}), 400

    try:
        user_id = decode_token(refresh_token)['sub']
        return jsonify({
            "success": True,
            "access_token": create_access_token(identity=str(user_id))
        }), 200
    except:
        print("[REFRESH FAILED] Invalid or expired token")
        return jsonify({"success": False, "message": "Invalid or expired refresh token"}), 401

@auth.route('/upload-identity-key', methods=['POST'])
@login_required
def upload_key(user):
    data = request.get_json()
    user.identity_public = data['identityPublic']
    db.session.commit()
    return jsonify({'success': True})

@auth.route('/get-identity-key/<username>', methods=['GET'])
@login_required
def get_key(user, username):
    target_user = User.query.filter_by(username=username).first()
    if not target_user:
        print("can't get keys for user not in database!")
        return jsonify({'success': False}), 404
    return jsonify({
        'success': True,
        'data': {'identityPublic': target_user.identity_public}
    })

@auth.route('/get-root-role', methods=['POST'])
@login_required
def get_root_role(user):
    data = request.get_json()
    friend_username = data['friendUsername']

    friend_user = User.query.filter_by(username=friend_username).first()

    # searches for root key set up object in database
    existing = RootKeySetup.query.filter(
        ((RootKeySetup.initiator_id == user.id) & (RootKeySetup.recipient_id == friend_user.id)) |
        ((RootKeySetup.initiator_id == friend_user.id) & (RootKeySetup.recipient_id == user.id))
    ).first()

    if not existing:

        # if root key setup object does not exist, then it creates it without the eph key, and returns initiator
        rootkey_setup = RootKeySetup(
            initiator_id=user.id,
            recipient_id=friend_user.id,
            ephemeral_public="")
        db.session.add(rootkey_setup)
        db.session.commit()
        return jsonify({'success': True, 'data': {'role': 'initiator'}})

    #root key setup object DOES exist at this point

    #returns initiator if it says ur the initiator
    if existing.initiator_id == user.id:
        return jsonify({'success': True, 'data': {'role': 'initiator'}})

    #returns recipient and eph key if you're the recipient
    else:
        ephemeral_key = existing.ephemeral_public

        db.session.delete(existing)
        db.session.commit()

        return jsonify({'success': True, 'data': {
            'role': 'recipient',
            'ephemeralPublic': ephemeral_key
        }})


@auth.route('/initiate-rootkey', methods=['POST'])
@login_required
def initiate_rootkey(user):
    data = request.get_json()
    friend_username = data['friendUsername']
    ephemeral_public = data['ephemeralPublic']

    friend_user = User.query.filter_by(username=friend_username).first()

    rootkey_setup = RootKeySetup.query.filter_by(
        initiator_id=user.id,
        recipient_id=friend_user.id
    ).first()

    rootkey_setup.ephemeral_public = ephemeral_public

    db.session.add(rootkey_setup)
    db.session.commit()

    return jsonify({'success': True})



