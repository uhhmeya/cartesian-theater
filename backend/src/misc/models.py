# noinspection PyUnresolvedReferences
from src.misc.extensions import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    #self = this = user object being operated on (ex: print(Ameya) means self=Ameya)
    def __repr__(self): #__repr__ = toString()
        return f'<User {self.username}>'