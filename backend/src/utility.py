from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from functools import wraps
from flask import jsonify
from src.misc import User

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(user_id)
            if not user:
                return jsonify({"success": False, "message": "User not found"}), 401
            return f(user, *args, **kwargs)
        except:
            return jsonify({"success": False, "message": "Invalid token"}), 401
    return decorated_function

