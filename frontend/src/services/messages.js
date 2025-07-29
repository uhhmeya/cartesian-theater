import { apiRequest } from './api'

export const loadConversationHistory = async (username) => {
    if (username === 'erik') return []
    const response = await apiRequest(`/conversation/${username}`, null, 'GET')
    return response.success ? response.data.messages : []
}

export const shouldScrollToBottom = (lastMessage, myUsername, activeFriend) => {
    if (!lastMessage || !activeFriend) return false
    return (lastMessage.sender === myUsername && lastMessage.receiver === activeFriend.username) ||
        (lastMessage.sender === activeFriend.username && lastMessage.receiver === myUsername)
}