import { decryptFromStorage } from './crypto/keys.js'
import { store } from './storage.js'

export const ephConvo = (messages, myUsername, friend) => {
    if (!friend) return []
    return messages.filter(msg =>
        !msg.persistent &&
        ((msg.sender === myUsername && msg.receiver === friend.username) ||
            (msg.sender === friend.username && msg.receiver === myUsername)))
}

export const permaConvo = (messages, myUsername, friend) => {
    if (!friend) return []
    return messages.filter(msg =>
        msg.persistent &&
        ((msg.sender === myUsername && msg.receiver === friend.username) ||
            (msg.sender === friend.username && msg.receiver === myUsername)))
}

export const loadPersistentMessages = async (friendUsername, privateKey) => {
    const key = `persistent_messages_${friendUsername}`
    const encrypted = localStorage.getItem(key)
    if (!encrypted) return []

    try {
        const decrypted = await decryptFromStorage(encrypted, privateKey)
        const messages = decrypted ? JSON.parse(decrypted) : []

        // Mark all loaded messages as delivered since they're already stored
        return messages.map(msg => ({
            ...msg,
            status: 'delivered'
        }))
    } catch (error) {
        console.error('Error loading persistent messages:', error)
        return []
    }
}

export const loadAllPersistentMessages = async (friends, privateKey) => {
    const allMessages = []
    for (const friend of friends) {
        const friendMessages = await loadPersistentMessages(friend.username, privateKey)
        allMessages.push(...friendMessages)
    }
    return allMessages
}

export const storePersistentMessage = async (friendUsername, message, privateKey) => {
    const key = `persistent_messages_${friendUsername}`
    const existingMessages = await loadPersistentMessages(friendUsername, privateKey)
    const updatedMessages = [...existingMessages, message]
    await store(key, JSON.stringify(updatedMessages), privateKey)
}