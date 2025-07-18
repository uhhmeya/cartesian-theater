from flask import Flask, request
from flask_cors import CORS
from datetime import timedelta
from src.auth import auth
from src.messages import messages
from src.misc import db, bcrypt, jwt, socketio, Message
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)

CORS(app,
     origins="*",
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=True,
     resources={r"/*": {"origins": "*"}})

logger.debug("🚀 Initializing Flask app with CORS enabled")

socketio.init_app(app,
                  cors_allowed_origins="*",
                  async_mode='threading',
                  logger=True,
                  engineio_logger=True,
                  ping_timeout=60,
                  ping_interval=25)

logger.debug("🔌 Socket.IO initialized")

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-here'

app.config['JWT_SECRET_KEY'] = 'your-jwt-secret-key-here'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(hours=12)
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'

logger.debug("🔐 JWT configuration set")

db.init_app(app)
bcrypt.init_app(app)
jwt.init_app(app)

app.register_blueprint(auth)
app.register_blueprint(messages)

logger.info("📘 Registered blueprints: auth, messages")

@app.route('/')
def root():
    logger.debug("✅ Root endpoint accessed")
    return "root api is healthy"

@app.before_request
def log_request_info():
    logger.debug(f"📥 {request.method} {request.path}")
    if request.method in ['POST', 'PUT', 'PATCH'] and request.is_json:
        try:
            logger.debug(f"   Body: {request.json}")
        except:
            pass

@app.after_request
def log_response_info(response):
    logger.debug(f"📤 Response: {response.status}")
    return response

def seed_initial_messages():
    """Seed initial messages for demo purposes"""
    from datetime import datetime, timedelta

    # Check if we already have messages
    existing = Message.query.first()
    if existing:
        logger.info("Messages already exist, skipping seed")
        return

    now = datetime.utcnow()

    # General channel messages
    messages = [
        Message(
            channel_id='general',
            user_id=0,  # System
            username='System',
            text='Welcome to Cartesian Theater!',
            timestamp=now - timedelta(hours=1)
        ),
        Message(
            channel_id='general',
            user_id=1001,  # Sarah Chen
            username='Sarah Chen',
            text='Hey everyone! How\'s it going? 👋',
            timestamp=now - timedelta(minutes=5),
            reactions='{"👍": [{"user_id": "1002", "username": "Alex Johnson"}]}'
        ),
        Message(
            channel_id='general',
            user_id=1002,  # Alex Johnson
            username='Alex Johnson',
            text='Pretty good! Just working on the new features. The typing indicators are looking great!',
            timestamp=now - timedelta(minutes=3),
            reactions='{"🎉": [{"user_id": "1001", "username": "Sarah Chen"}]}'
        ),
        Message(
            channel_id='general',
            user_id=999999,  # erik_ai
            username='erik_ai',
            text='I\'ve analyzed the chat patterns. The average response time is 42 seconds. Fascinating! 🤖',
            timestamp=now - timedelta(minutes=1),
            reactions='{"🤖": [{"user_id": "1001", "username": "Sarah Chen"}, {"user_id": "1002", "username": "Alex Johnson"}]}'
        ),

        # erik_ai DM channel
        Message(
            channel_id='erik_ai',
            user_id=999999,
            username='erik_ai',
            text='Hello! I\'m Erik, your AI assistant. How can I help you today?',
            timestamp=now - timedelta(minutes=5)
        ),

        # Sarah Chen DM
        Message(
            channel_id='sarah_chen',
            user_id=1001,
            username='Sarah Chen',
            text='Hey! Did you see the new message reactions feature?',
            timestamp=now - timedelta(minutes=2)
        ),

        # Random channel
        Message(
            channel_id='random',
            user_id=1002,
            username='Alex Johnson',
            text='Anyone up for some gaming later?',
            timestamp=now - timedelta(minutes=30)
        ),
        Message(
            channel_id='random',
            user_id=1001,
            username='Sarah Chen',
            text='Sure! I\'ll be free after 6pm',
            timestamp=now - timedelta(minutes=25)
        ),

        # Gaming channel
        Message(
            channel_id='gaming',
            user_id=1002,
            username='Alex Johnson',
            text='Just got the new game! It\'s amazing 🎮',
            timestamp=now - timedelta(hours=2)
        )
    ]

    # Add all messages to database
    for msg in messages:
        db.session.add(msg)

    db.session.commit()
    logger.info(f"✅ Seeded {len(messages)} initial messages")

if __name__ == '__main__':
    with app.app_context():
        logger.info("🗄️  Creating database tables...")
        db.create_all()
        logger.info("✅ Database tables created")

        logger.info("🌱 Seeding initial data...")
        seed_initial_messages()

    logger.info("🚀 Starting server on http://127.0.0.1:5001")
    socketio.run(app, debug=True, host='127.0.0.1', port=5001)

from src.misc import db, Message
from datetime import datetime, timedelta

def seed_initial_messages():
    """Seed initial messages for demo purposes"""

    # Check if we already have messages
    existing = Message.query.first()
    if existing:
        print("Messages already exist, skipping seed")
        return

    now = datetime.utcnow()

    # General channel messages
    messages = [
        Message(
            channel_id='general',
            user_id=0,  # System
            username='System',
            text='Welcome to Cartesian Theater!',
            timestamp=now - timedelta(hours=1)
        ),
        Message(
            channel_id='general',
            user_id=1001,  # Sarah Chen
            username='Sarah Chen',
            text='Hey everyone! How\'s it going? 👋',
            timestamp=now - timedelta(minutes=5)
        ),
        Message(
            channel_id='general',
            user_id=1002,  # Alex Johnson
            username='Alex Johnson',
            text='Pretty good! Just working on the new features. The typing indicators are looking great!',
            timestamp=now - timedelta(minutes=3)
        ),
        Message(
            channel_id='general',
            user_id=999999,  # erik_ai
            username='erik_ai',
            text='I\'ve analyzed the chat patterns. The average response time is 42 seconds. Fascinating! 🤖',
            timestamp=now - timedelta(minutes=1)
        ),

        # erik_ai DM channel
        Message(
            channel_id='erik_ai',
            user_id=999999,
            username='erik_ai',
            text='Hello! I\'m Erik, your AI assistant. How can I help you today?',
            timestamp=now - timedelta(minutes=5)
        ),

        # Sarah Chen DM
        Message(
            channel_id='sarah_chen',
            user_id=1001,
            username='Sarah Chen',
            text='Hey! Did you see the new message reactions feature?',
            timestamp=now - timedelta(minutes=2)
        ),

        # Random channel
        Message(
            channel_id='random',
            user_id=1002,
            username='Alex Johnson',
            text='Anyone up for some gaming later?',
            timestamp=now - timedelta(minutes=30)
        ),
        Message(
            channel_id='random',
            user_id=1001,
            username='Sarah Chen',
            text='Sure! I\'ll be free after 6pm',
            timestamp=now - timedelta(minutes=25)
        ),

        # Gaming channel
        Message(
            channel_id='gaming',
            user_id=1002,
            username='Alex Johnson',
            text='Just got the new game! It\'s amazing 🎮',
            timestamp=now - timedelta(hours=2)
        )
    ]

    # Add all messages to database
    for msg in messages:
        db.session.add(msg)

    db.session.commit()
    print(f"✅ Seeded {len(messages)} initial messages")


if __name__ == '__main__':
    from app import app

    with app.app_context():
        seed_initial_messages()