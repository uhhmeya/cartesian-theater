from datetime import datetime
from extensions import db

class RootKeySetup(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    initiator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    ephemeral_public = db.Column(db.Text, nullable=False)