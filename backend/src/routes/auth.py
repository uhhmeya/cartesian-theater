from flask import Blueprint, request, jsonify
from extensions import db, bcrypt
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token
from src.models import User

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