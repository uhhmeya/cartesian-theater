from flask import Flask
from flask_cors import CORS
from datetime import timedelta
from src.auth import auth
from src.misc import db, bcrypt, jwt, socketio


app = Flask(__name__)

CORS(app, origins="*", allow_headers=["Content-Type", "Authorization"], supports_credentials=True)

socketio.init_app(app,
                  cors_allowed_origins="*",
                  async_mode='threading',
                  logger=True,
                  engineio_logger=True
                  )

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your-secret-key-here'

app.config['JWT_SECRET_KEY'] = 'your-jwt-secret-key-here'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(hours=12)

db.init_app(app)
bcrypt.init_app(app)
jwt.init_app(app)
app.register_blueprint(auth)

@app.route('/')
def root():
    return "root api is healthy"


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=True, host='127.0.0.1', port=5001)