# noinspection PyUnresolvedReferences
from flask_sqlalchemy import SQLAlchemy
# noinspection PyUnresolvedReferences
from flask_bcrypt import Bcrypt
# noinspection PyUnresolvedReferences
from flask_jwt_extended import JWTManager

db = SQLAlchemy()
bcrypt = Bcrypt()
jwt = JWTManager()