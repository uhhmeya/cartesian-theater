from flask import jsonify
from src.misc import User, bcrypt, db
import re
from flask_jwt_extended import create_access_token, create_refresh_token
from functools import wraps
import secrets
from datetime import datetime, timedelta

COMMON_PASSWORDS = {
    'password', 'letmein', '123456', 'password123', 'admin123',
    'qwerty', 'abc123', 'monkey', 'dragon', 'football',
    'iloveyou', 'trustno1', '1234567', '12345678', '123456789'
}

RESERVED_USERNAMES = {
    'admin', 'root', 'user', 'test', 'demo', 'null', 'undefined', 'sample'
}

PAGE_TOKENS = {}

def checkCredentials(username, password):
    if not username or not password:
        return jsonify({
            "message": "Both username and password are required",
            "success": False,
            "error_type": "bad_format"
        }), 400

    user = User.query.filter_by(username=username.strip().lower()).first()

    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({
            "message": "Invalid username or password",
            "success": False,
            "error_type": "invalid_credentials"
        }), 401

    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)

    return jsonify({
        "message": "Login successful",
        "success": True,
        "user_id": user.id,
        "username": user.username,
        "access_token": access_token,
        "refresh_token": refresh_token
    }), 200

def checkFormat(username, password):
    if not username or not password:
        return jsonify({
            "message": "Both username and password are required",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if not isinstance(username, str) or not isinstance(password, str):
        return jsonify({
            "message": "Username and password must be strings",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if not username.strip() or not password.strip():
        return jsonify({
            "message": "Username and password cannot be empty or whitespace",
            "success": False,
            "error_type": "bad_format"
        }), 400

    username = username.strip().lower()
    password = password.strip()

    if len(username) < 4 or len(username) > 32:
        return jsonify({
            "message": "Username must be between 4 and 32 characters",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if not re.match(r'^[A-Za-z0-9_.]+$', username):
        return jsonify({
            "message": "Username can only contain letters, numbers, underscore, and period",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if username[0].isdigit():
        return jsonify({
            "message": "Username cannot start with a number",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if username[0] in '_.' or username[-1] in '_.':
        return jsonify({
            "message": "Username cannot start or end with underscore or period",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if '__' in username or '..' in username:
        return jsonify({
            "message": "Username cannot contain consecutive underscores or periods",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if username.isdigit():
        return jsonify({
            "message": "Username cannot be entirely numeric",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if username in RESERVED_USERNAMES:
        return jsonify({
            "message": "This username is not allowed",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if username == password.lower():
        return jsonify({
            "message": "Username and password cannot be the same",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if len(password) < 8 or len(password) > 64:
        return jsonify({
            "message": "Password must be between 8 and 64 characters",
            "success": False,
            "error_type": "bad_format"
        }), 400

    has_upper = bool(re.search(r'[A-Z]', password))
    has_lower = bool(re.search(r'[a-z]', password))
    has_digit = bool(re.search(r'[0-9]', password))
    has_special = bool(re.search(r'[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]', password))

    complexity_count = sum([has_upper, has_lower, has_digit, has_special])
    if complexity_count < 3:
        return jsonify({
            "message": "Password must contain at least 3 of: uppercase, lowercase, numbers, special characters",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if password.lower() in COMMON_PASSWORDS:
        return jsonify({
            "message": "Password is too common. Please choose a stronger password",
            "success": False,
            "error_type": "bad_format"
        }), 400

    if re.search(r'(.)\1{5,}', password):
        return jsonify({
            "message": "Password cannot contain repetitive characters",
            "success": False,
            "error_type": "bad_format"
        }), 400

    sequences = [
        'abcdefghijklmnopqrstuvwxyz', '0123456789',
        'qwertyuiop', 'asdfghjkl', 'zxcvbnm'
    ]
    password_lower = password.lower()
    for seq in sequences:
        for i in range(len(seq) - 5):
            if seq[i:i+6] in password_lower or seq[i:i+6][::-1] in password_lower:
                return jsonify({
                    "message": "Password cannot contain sequential characters or keyboard patterns",
                    "success": False,
                    "error_type": "bad_format"
                }), 400

    if username in password.lower():
        return jsonify({
            "message": "Password cannot contain your username",
            "success": False,
            "error_type": "bad_format"
        }), 400

    return jsonify({
        "message": "Signup format valid",
        "success": True
    }), 201

def addUser(username, password):
    username = username.strip().lower()

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return jsonify({
            "message": "Username already exists",
            "success": False,
            "error_type": "username_already_exists"
        }), 409

    try:
        hashed_pw = bcrypt.generate_password_hash(password).decode('utf-8')
        new_user = User(username=username, password_hash=hashed_pw)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({
            "message": "Signup successful",
            "success": True,
            "user_id": new_user.id,
            "username": new_user.username
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error creating user: {e}")  # Log the error for debugging
        return jsonify({
            "message": "Internal server error while creating user",
            "success": False,
            "error_type": "server_error"
        }), 500

def verifyAccessToken():
    from flask import request, jsonify
    from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity

    try:
        # Check if there's a valid JWT token in the request
        verify_jwt_in_request()

        # Get the user ID from the token
        user_id = get_jwt_identity()

        # Get the actual user from database
        user = User.query.get(user_id)
        if not user:
            return None, jsonify({
                "message": "User not found",
                "success": False,
                "error_type": "invalid_user"
            }), 401

        # Return the user if everything is valid
        return user, None, None

    except Exception as e:
        return None, jsonify({
            "message": "Invalid or expired token",
            "success": False,
            "error_type": "invalid_token"
        }), 401

def extractRefreshToken():
    """Get refresh token from request body"""
    from flask import request, jsonify

    refresh_token = request.get_json().get('refresh_token')

    if not refresh_token:
        return None, jsonify({
            "message": "Refresh token is required",
            "success": False,
            "error_type": "missing_refresh_token"
        }), 400

    return refresh_token, None, None

def validateRefreshToken(refresh_token):
    """Check if refresh token is valid and return user_id"""
    from flask import jsonify
    from flask_jwt_extended import decode_token

    try:
        # Decode and validate the refresh token
        decoded_token = decode_token(refresh_token)
        user_id = decoded_token['sub']  # 'sub' contains the user ID

        return user_id, None, None

    except Exception as e:
        return None, jsonify({
            "message": "Invalid or expired refresh token",
            "success": False,
            "error_type": "invalid_refresh_token"
        }), 401

def createNewAccessToken(user_id):
    """Create new access token for user"""
    from flask import jsonify
    from flask_jwt_extended import create_access_token

    try:
        new_access_token = create_access_token(identity=user_id)

        return new_access_token, None, None

    except Exception as e:
        return None, jsonify({
            "message": "Failed to create new access token",
            "success": False,
            "error_type": "token_creation_failed"
        }), 500

def displayUsers():
    """Get all users with minimal information for debugging"""
    from flask import jsonify
    from datetime import datetime

    try:
        users = User.query.all()

        # Simple list of users - just ID and username
        user_list = []
        for user in users:
            user_list.append({
                "id": user.id,
                "username": user.username
            })

        return {
            "total_users": len(users),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "users": user_list
        }, None, None

    except Exception as e:
        return None, jsonify({
            "message": "Failed to retrieve users",
            "success": False,
            "error_type": "database_error"
        }), 500

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user, error_response, status_code = verifyAccessToken()
        if user is None:
            return error_response, status_code
        # Make user available to the route
        return f(user, *args, **kwargs)
    return decorated_function

def extractAccessTokenFromWebSocket():
    """Get access token from WebSocket query params"""
    from flask import request, jsonify

    print(f"Query args: {request.args}")  # ADD THIS
    print(f"Full URL: {request.url}")     # ADD THIS

    access_token = request.args.get('token')

    if not access_token:
        return None, jsonify({
            "message": "Access token is required",
            "success": False,
            "error_type": "missing_access_token"
        }), 400

    return access_token, None, None


def validateAccessToken(access_token):
    """Check if access token is valid and return user info"""
    from flask import jsonify
    from flask_jwt_extended import decode_token
    from src.misc import User

    print(f"Validating token: {access_token[:20]}...")  # Print first 20 chars for debugging

    try:
        # Use Flask-JWT-Extended's decode_token which handles the secret key internally
        decoded = decode_token(access_token)
        print(f"Token decoded successfully: {decoded}")

        # Check if token is expired
        from datetime import datetime
        exp_timestamp = decoded.get('exp')
        if exp_timestamp and datetime.utcnow().timestamp() > exp_timestamp:
            print("Token is expired")
            return None, jsonify({
                "message": "Token has expired",
                "success": False,
                "error_type": "expired_token"
            }), 401

        user_id = decoded.get('sub')  # 'sub' contains the user ID
        user = User.query.get(user_id)

        if not user:
            print(f"User not found for ID: {user_id}")
            return None, jsonify({
                "message": "User not found",
                "success": False,
                "error_type": "invalid_user"
            }), 401

        print(f"User validated: {user.username}")
        return {
            'user_id': user_id,
            'username': user.username,
            'user': user
        }, None, None

    except Exception as e:
        print(f"Token validation error: {type(e).__name__}: {str(e)}")
        return None, jsonify({
            "message": "Invalid or expired access token",
            "success": False,
            "error_type": "invalid_access_token"
        }), 401

