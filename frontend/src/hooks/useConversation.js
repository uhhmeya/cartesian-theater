export const useConversation = (messages, myUsername, activeFriend) => {
    if (!activeFriend) return []
    return messages.filter(msg =>
        (msg.sender === myUsername && msg.receiver === activeFriend.username) ||
        (msg.sender === activeFriend.username && msg.receiver === myUsername)
    )
}