from datetime import datetime

from flask import Blueprint, request, jsonify
from extensions import db, bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from src.models import User
from src.models.eph_secret_setup import EphSecretSetup
from src.routes.utility import login_required
from src.models.prekey import Prekey

auth = Blueprint('auth', __name__)

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
    existing = EphSecretSetup.query.filter(
        ((EphSecretSetup.initiator_id == user.id) & (EphSecretSetup.recipient_id == friend_user.id)) |
        ((EphSecretSetup.initiator_id == friend_user.id) & (EphSecretSetup.recipient_id == user.id))
    ).first()

    if not existing:

        eph_secret_setup = EphSecretSetup(
            initiator_id=user.id,
            recipient_id=friend_user.id,
            ephemeral_public="")

        db.session.add(eph_secret_setup)
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

    eph_secret_setup = EphSecretSetup.query.filter_by(
        initiator_id=user.id,
        recipient_id=friend_user.id
    ).first()

    eph_secret_setup.ephemeral_public = ephemeral_public

    db.session.add(eph_secret_setup)
    db.session.commit()

    return jsonify({'success': True})

@auth.route('/upload-prekeys', methods=['POST'])
@login_required
def upload_prekeys(user):
    data = request.get_json()
    prekeys = data['prekeys']

    for index, prekey_data in enumerate(prekeys):
        prekey = Prekey(
            user_id=user.id,
            prekey_index=index,
            public_key=prekey_data['public'],
            signature=prekey_data['signature']
        )
        db.session.add(prekey)

    db.session.commit()
    return jsonify({'success': True})

@auth.route('/get-prekey/<username>', methods=['GET'])
@login_required
def get_prekey(user, username):
    target_user = User.query.filter_by(username=username).first()
    if not target_user:
        return jsonify({'success': False}), 404

    prekey = Prekey.query.filter_by(user_id=target_user.id, consumed_by_user_id=None).first()
    if not prekey:
        return jsonify({'success': False, 'message': 'No prekeys available'}), 404

    result = {
        'success': True,
        'data': {
            'publicKey': prekey.public_key,
            'signature': prekey.signature,
            'prekeyIndex': prekey.prekey_index
        }
    }

    prekey.consumed_by_user_id = user.id
    prekey.consumed_at = datetime.utcnow()
    db.session.commit()

    return jsonify(result)

