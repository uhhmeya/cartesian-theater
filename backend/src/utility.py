from flask import jsonify, request
from src.misc import User, bcrypt, db, Message
import re
from flask_jwt_extended import create_access_token, create_refresh_token, decode_token, verify_jwt_in_request, get_jwt_identity
from functools import wraps
from datetime import datetime, timedelta, timezone
import json
from flask_socketio import emit
import random

COMMON_PASSWORDS = {
    'password', 'letmein', '123456', 'password123', 'admin123',
    'qwerty', 'abc123', 'monkey', 'dragon', 'football',
    'iloveyou', 'trustno1', '1234567', '12345678', '123456789'
}

RESERVED_USERNAMES = {
    'admin', 'root', 'user', 'test', 'demo', 'null', 'undefined', 'sample'
}

AI_RESPONSES = [
    "I understand your message. How can I help you further?",
    "That's interesting! Tell me more about that.",
    "I'm here to assist you. What would you like to know?",
    "Thanks for your message! Is there anything specific you'd like to discuss?",
    "I see what you mean. Let me think about that for a moment...",
    "Great question! Here's what I think...",
    "I appreciate you reaching out. How can I be of assistance?",
    "That's a thoughtful point. Would you like to explore it further?",
    "I'm processing your request. Is there anything else you need?",
    "Interesting perspective! I'd love to hear more of your thoughts."
]

online_users = {}
typing_users = {}

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

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

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
        return jsonify({
            "message": "Internal server error while creating user",
            "success": False,
            "error_type": "server_error"
        }), 500

def verifyAccessToken():
    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()

        user = User.query.get(user_id)
        if not user:
            return None, jsonify({
                "message": "User not found",
                "success": False,
                "error_type": "invalid_user"
            }), 401

        return user, None, None

    except Exception as e:
        return None, jsonify({
            "message": "Invalid or expired token",
            "success": False,
            "error_type": "invalid_token"
        }), 401

def extractRefreshToken():
    refresh_token = request.get_json().get('refresh_token')

    if not refresh_token:
        return None, jsonify({
            "message": "Refresh token is required",
            "success": False,
            "error_type": "missing_refresh_token"
        }), 400

    return refresh_token, None, None

def validateRefreshToken(refresh_token):
    try:
        decoded_token = decode_token(refresh_token)
        user_id = decoded_token['sub']
        return user_id, None, None

    except Exception as e:
        return None, jsonify({
            "message": "Invalid or expired refresh token",
            "success": False,
            "error_type": "invalid_refresh_token"
        }), 401

def createNewAccessToken(user_id):
    try:
        new_access_token = create_access_token(identity=str(user_id))
        return new_access_token, None, None

    except Exception as e:
        return None, jsonify({
            "message": "Failed to create new access token",
            "success": False,
            "error_type": "token_creation_failed"
        }), 500

def displayUsers():
    try:
        users = User.query.all()

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
        return f(user, *args, **kwargs)
    return decorated_function

def extractAccessTokenFromWebSocket():
    access_token = request.args.get('token')

    if not access_token:
        return None, jsonify({
            "message": "Access token is required",
            "success": False,
            "error_type": "missing_access_token"
        }), 400

    return access_token, None, None

def validateAccessToken(access_token):
    try:
        decoded = decode_token(access_token)

        exp_timestamp = decoded.get('exp')
        if exp_timestamp:
            current_time = datetime.now(timezone.utc).timestamp()
            if current_time > exp_timestamp:
                return None, jsonify({
                    "message": "Token has expired",
                    "success": False,
                    "error_type": "expired_token"
                }), 401

        user_id = decoded.get('sub')
        if not user_id:
            return None, jsonify({
                "message": "Invalid token format",
                "success": False,
                "error_type": "invalid_token"
            }), 401

        try:
            user_id_int = int(user_id)
        except (ValueError, TypeError):
            return None, jsonify({
                "message": "Invalid user ID format",
                "success": False,
                "error_type": "invalid_token"
            }), 401

        user = User.query.get(user_id_int)
        if not user:
            return None, jsonify({
                "message": "User not found",
                "success": False,
                "error_type": "invalid_user"
            }), 401

        return {
            'user_id': str(user_id_int),
            'username': user.username,
            'user': user
        }, None, None

    except Exception as e:
        return None, jsonify({
            "message": "Invalid or expired access token",
            "success": False,
            "error_type": "invalid_access_token"
        }), 401

def get_chat_messages(user, channel_id):
    page = request.args.get('page', 1, type=int)
    per_page = 50

    try:
        messages_query = Message.query.filter_by(channel_id=channel_id) \
            .order_by(Message.timestamp.desc()) \
            .paginate(page=page, per_page=per_page, error_out=False)

        messages_list = []
        for msg in messages_query.items:
            messages_list.append({
                'id': msg.id,
                'channel_id': msg.channel_id,
                'user_id': str(msg.user_id),
                'user': msg.username,
                'text': msg.text,
                'timestamp': msg.timestamp.isoformat(),
                'is_read': msg.is_read,
                'reactions': json.loads(msg.reactions)
            })

        messages_list.reverse()

        unread_counts = {}
        channels = ['general', 'random', 'tech', 'gaming', 'erik_ai', 'sarah_chen', 'alex_johnson']

        for channel in channels:
            count = Message.query.filter_by(channel_id=channel, is_read=False) \
                .filter(Message.user_id != user.id).count()
            unread_counts[channel] = count

        updated = Message.query.filter_by(channel_id=channel_id) \
            .filter(Message.user_id != user.id) \
            .update({'is_read': True})
        db.session.commit()

        return jsonify({
            'success': True,
            'messages': messages_list,
            'unread_counts': unread_counts,
            'has_more': messages_query.has_next,
            'page': page
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'messages': [],
            'unread_counts': {},
            'error': str(e)
        }), 500

def generate_ai_response(user_message):
    message_lower = user_message.lower()

    if any(greeting in message_lower for greeting in ['hi', 'hello', 'hey', 'greetings']):
        responses = [
            "Hello! How can I assist you today?",
            "Hi there! What can I help you with?",
            "Greetings! I'm here to help. What's on your mind?",
            "Hey! Nice to meet you. How can I be of service?"
        ]
    elif any(q in message_lower for q in ['how are you', "how're you", 'how do you do']):
        responses = [
            "I'm functioning well, thank you for asking! How are you doing?",
            "I'm here and ready to help! How about you?",
            "All systems operational! What brings you here today?",
            "I'm doing great! Thanks for asking. How can I assist you?"
        ]
    elif any(q in message_lower for q in ['what can you do', 'help', 'what do you do']):
        responses = [
            "I can help with a variety of tasks! Feel free to ask me anything.",
            "I'm here to assist with questions, provide information, and have conversations!",
            "I can help answer questions, discuss topics, or just chat. What interests you?",
            "I'm your AI assistant - I can help with information, answer questions, or just have a friendly chat!"
        ]
    elif any(word in message_lower for word in ['thanks', 'thank you', 'appreciate']):
        responses = [
            "You're welcome! Is there anything else I can help with?",
            "Happy to help! Let me know if you need anything else.",
            "My pleasure! Feel free to ask if you have more questions.",
            "Glad I could assist! Don't hesitate to reach out again."
        ]
    else:
        responses = AI_RESPONSES

    return random.choice(responses)

def handle_websocket_message(session, data):
    from flask_socketio import emit

    channel_id = data.get('channel')
    text = data.get('text')

    if not channel_id or not text:
        return

    user_id = session.get('user_id')
    username = session.get('username')

    message = Message(
        channel_id=channel_id,
        user_id=int(user_id),
        username=username,
        text=text
    )
    db.session.add(message)
    db.session.commit()

    emit('message', {
        'id': message.id,
        'channel_id': channel_id,
        'user_id': user_id,
        'user': username,
        'text': text,
        'timestamp': message.timestamp.isoformat(),
        'reactions': {}
    }, room=channel_id, include_self=False)

    if channel_id == 'erik_ai':
        ai_response_text = generate_ai_response(text)

        ai_message = Message(
            channel_id=channel_id,
            user_id=999999,
            username='erik_ai',
            text=ai_response_text
        )
        db.session.add(ai_message)
        db.session.commit()

        emit('message', {
            'id': ai_message.id,
            'channel_id': channel_id,
            'user_id': '999999',
            'user': 'erik_ai',
            'text': ai_response_text,
            'timestamp': ai_message.timestamp.isoformat(),
            'reactions': {},
            'isAI': True
        }, room=channel_id)

def handle_user_typing(session, data):
    from flask_socketio import emit

    channel_id = data.get('channel_id')
    is_typing = data.get('is_typing', False)

    user_id = session.get('user_id')
    username = session.get('username')

    if not channel_id or not user_id:
        return

    if channel_id not in typing_users:
        typing_users[channel_id] = {}

    if is_typing:
        typing_users[channel_id][user_id] = username
    else:
        typing_users[channel_id].pop(user_id, None)

    emit('typing_update', {
        'channel_id': channel_id,
        'typing_users': list(typing_users[channel_id].values())
    }, room=channel_id, include_self=False)

def handle_add_reaction(session, data):
    from flask_socketio import emit

    message_id = data.get('message_id')
    emoji = data.get('emoji')

    if isinstance(message_id, str) and message_id.startswith('temp-'):
        return

    user_id = session.get('user_id')
    username = session.get('username')

    message = Message.query.get(message_id)
    if not message:
        return

    reactions = json.loads(message.reactions)
    if emoji not in reactions:
        reactions[emoji] = []

    user_data = {'user_id': user_id, 'username': username}

    user_exists = any(u['user_id'] == user_id for u in reactions[emoji])
    if user_exists:
        reactions[emoji] = [u for u in reactions[emoji] if u['user_id'] != user_id]
        if not reactions[emoji]:
            del reactions[emoji]
    else:
        reactions[emoji].append(user_data)

    message.reactions = json.dumps(reactions)
    db.session.commit()

    emit('reaction_update', {
        'message_id': message_id,
        'reactions': reactions
    }, room=message.channel_id)

def handle_user_online(session):
    from flask_socketio import emit

    user_id = session.get('user_id')
    username = session.get('username')

    if user_id:
        online_users[user_id] = {
            'username': username,
            'status': 'online',
            'last_seen': datetime.utcnow().isoformat()
        }

        emit('presence_update', {
            'online_users': online_users
        }, broadcast=True)

def handle_user_disconnect(session):
    from flask_socketio import emit

    user_id = session.get('user_id')
    username = session.get('username')

    if user_id:
        if user_id in online_users:
            online_users[user_id]['status'] = 'offline'
            online_users[user_id]['last_seen'] = datetime.utcnow().isoformat()

        for channel_id in typing_users:
            if user_id in typing_users[channel_id]:
                del typing_users[channel_id][user_id]
                emit('typing_update', {
                    'channel_id': channel_id,
                    'typing_users': list(typing_users[channel_id].values())
                }, room=channel_id)

        emit('presence_update', {
            'online_users': online_users
        }, broadcast=True)