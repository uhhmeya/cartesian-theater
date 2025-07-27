export const Message = ({ message, myUsername }) => (
    <div className={`chat-message ${message.sender === myUsername ? 'own-message' : ''}`}>
        <div className="message-wrapper">
            <div className="message-bubble">
                <div className="message-text">{message.text}</div>
            </div>
            {message.sender !== myUsername && <div className="message-sender">{message.sender}</div>}
        </div>
    </div>
)

// Message component takes in the messages array and myUsername. Its one bubble.