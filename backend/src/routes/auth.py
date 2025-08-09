from flask import Blueprint, request, jsonify
from extensions import db, bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from src.models import User
from src.utils import login_required

auth = Blueprint('auth', __name__)

#http public
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

    print(f"[SIGNIN SUCCESS] {username} logged in")
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
        print(f"[SIGNUP FAILED] Invalid input - username: '{username}' ({len(username)} chars), password: {'***' if password else 'empty'} ({len(password)} chars)")
        return jsonify({"success": False, "message": "Username min 4 chars, password min 8 chars"}), 400

    if User.query.filter_by(username=username).first():
        print(f"[SIGNUP FAILED] Username '{username}' already exists")
        return jsonify({"success": False, "message": "Username already exists"}), 409

    user = User(username=username, password_hash=bcrypt.generate_password_hash(password).decode('utf-8'))
    db.session.add(user)
    db.session.commit()
    print(f"[SIGNUP SUCCESS] Created user: {username}")

    return jsonify({"success": True}), 201

#http special
@auth.route('/refresh', methods=['POST'])
def refresh():
    refresh_token = request.get_json().get('refresh_token')
    if not refresh_token:
        print("[REFRESH FAILED] No refresh token provided")
        return jsonify({"success": False, "message": "Refresh token is required"}), 400

    try:
        user_id = decode_token(refresh_token)['sub']
        print(f"[REFRESH SUCCESS] User ID {user_id} refreshed token")
        return jsonify({
            "success": True,
            "access_token": create_access_token(identity=str(user_id))
        }), 200
    except:
        print("[REFRESH FAILED] Invalid or expired token")
        return jsonify({"success": False, "message": "Invalid or expired refresh token"}), 401

@auth.route('/upload-keyBundle', methods=['POST'])
@login_required
def upload_key_bundle(user):

    data = request.get_json()

    user.identity_public = data['identityPublic']
    user.weekly_public = data['weeklyPublic']
    user.weekly_signature = data['weeklySignature']
    user.single_use_keys = data['singleUsePublics']

    db.session.commit()
    print(f"[KEY UPLOAD SUCCESS] User {user.username} uploaded complete key bundle")
    return jsonify({'success': True})

@auth.route('/get-keys/<username>', methods=['GET'])
@login_required
def get_user_keys(user, username):
    target_user = User.query.filter_by(username=username).first()
    if not target_user: return jsonify({'success': False}), 404

    if not target_user.single_use_keys: return jsonify({'success': False, 'message': 'No keys available'}), 400

    single_use_key = target_user.single_use_keys.pop(0)
    db.session.commit()
    print(f"[KEY RETRIEVAL SUCCESS] {user.username} retrieved keys for {username}")

    return jsonify({
        'success': True,
        'data': {
            'identityPublic': target_user.identity_public,
            'weeklyPublic': target_user.weekly_public,
            'weeklySignature': target_user.weekly_signature,
            'singleUseKey': single_use_key
        }
    })