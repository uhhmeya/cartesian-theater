from datetime import datetime
from threading import Timer
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity, decode_token
from functools import wraps
from flask import jsonify, request
from src.models import User

def verify_access_token(token):
    try:
        decoded = decode_token(token)
        user_id = int(decoded['sub'])
        user = User.query.get(user_id)
        return user if user else None
    except:
        return None

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            print(f"=== LOGIN REQUIRED DEBUG ===")
            print(f"Request headers: {request.headers}")
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            print(f"User ID from token: {user_id}")
            user = User.query.get(user_id)
            if not user:
                return jsonify({"success": False, "message": "User not found"}), 401
            return f(user, *args, **kwargs)
        except Exception as e:
            print(f"Auth error: {e}")
            return jsonify({"success": False, "message": "Invalid token"}), 401
    return decorated_function