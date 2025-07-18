from flask import Flask, request
from flask_cors import CORS
from datetime import timedelta
from src.auth import auth
from src.misc import db, bcrypt, jwt, socketio, Message
import logging

logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

app = Flask(__name__)

CORS(app,
     origins="*",
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=True,
     resources={r"/*": {"origins": "*"}})

socketio.init_app(app,
                  cors_allowed_origins="*",
                  async_mode='threading',
                  logger=False,
                  engineio_logger=False,
                  ping_timeout=60,
                  ping_interval=25)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-here'

app.config['JWT_SECRET_KEY'] = 'your-jwt-secret-key-here'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(hours=12)
app.config['JWT_TOKEN_LOCATION'] = ['headers']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'

db.init_app(app)
bcrypt.init_app(app)
jwt.init_app(app)

app.register_blueprint(auth)

@app.route('/')
def root():
    return "root api is healthy"

def seed_initial_messages():
    from datetime import datetime, timedelta

    existing = Message.query.first()
    if existing:
        return

    now = datetime.utcnow()

    messages = [
        Message(
            channel_id='general',
            user_id=0,
            username='System',
            text='Welcome to Cartesian Theater!',
            timestamp=now - timedelta(hours=1)
        ),
        Message(
            channel_id='general',
            user_id=1001,
            username='Sarah Chen',
            text='Hey everyone! How\'s it going? 👋',
            timestamp=now - timedelta(minutes=5),
            reactions='{"👍": [{"user_id": "1002", "username": "Alex Johnson"}]}'
        ),
        Message(
            channel_id='general',
            user_id=1002,
            username='Alex Johnson',
            text='Pretty good! Just working on the new features. The typing indicators are looking great!',
            timestamp=now - timedelta(minutes=3),
            reactions='{"🎉": [{"user_id": "1001", "username": "Sarah Chen"}]}'
        ),
        Message(
            channel_id='general',
            user_id=999999,
            username='erik_ai',
            text='I\'ve analyzed the chat patterns. The average response time is 42 seconds. Fascinating! 🤖',
            timestamp=now - timedelta(minutes=1),
            reactions='{"🤖": [{"user_id": "1001", "username": "Sarah Chen"}, {"user_id": "1002", "username": "Alex Johnson"}]}'
        ),
        Message(
            channel_id='erik_ai',
            user_id=999999,
            username='erik_ai',
            text='Hello! I\'m Erik, your AI assistant. How can I help you today?',
            timestamp=now - timedelta(minutes=5)
        ),
        Message(
            channel_id='sarah_chen',
            user_id=1001,
            username='Sarah Chen',
            text='Hey! Did you see the new message reactions feature?',
            timestamp=now - timedelta(minutes=2)
        ),
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
        Message(
            channel_id='gaming',
            user_id=1002,
            username='Alex Johnson',
            text='Just got the new game! It\'s amazing 🎮',
            timestamp=now - timedelta(hours=2)
        )
    ]

    for msg in messages:
        db.session.add(msg)

    db.session.commit()

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_initial_messages()

    socketio.run(app, debug=True, host='127.0.0.1', port=5001)