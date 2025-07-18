from flask import Blueprint
from src.utility import login_required, get_chat_messages
import logging

logger = logging.getLogger(__name__)

messages = Blueprint('messages', __name__)

@messages.route('/messages/<channel_id>', methods=['GET'])
@login_required
def get_messages(user, channel_id):
    logger.info(f"📨 Getting messages for channel: {channel_id}")
    logger.debug(f"   User: {user.username} (ID: {user.id})")

    result = get_chat_messages(user, channel_id)

    if result[1] == 200:
        data = result[0].get_json()
        logger.debug(f"   Found {len(data['messages'])} messages")
        logger.debug(f"   Unread counts: {data['unread_counts']}")
    else:
        logger.warning(f"   Failed to get messages: {result[1]}")

    return result