export const Message = ({ message, myUsername, isLatest }) => {
    return (
        <div className={`chat-message ${message.sender === myUsername ? 'own-message' : ''}`}>
            <div className="message-wrapper">
                <div className="message-bubble">
                    <div className="message-text">{message.text}</div>
                </div>
                {message.sender !== myUsername && <div className="message-sender">{message.sender}</div>}
                {isLatest && message.status && (
                    <div className="message-status">{message.status}</div>
                )}
            </div>
        </div>
    )
}