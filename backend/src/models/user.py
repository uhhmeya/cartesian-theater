from extensions import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    outgoing_requests = db.relationship('FriendRequest', foreign_keys='FriendRequest.sender_id', backref='sender')
    incoming_requests = db.relationship('FriendRequest', foreign_keys='FriendRequest.receiver_id', backref='receiver')