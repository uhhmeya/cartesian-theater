import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { StarryBackground, ChatSidebar, ChatMain } from '../helpers/components.jsx'
import {
    connectWebSocket, setupWebSocketHandlers, handleLogout, sendMessage,
    initializeDashboardData, getChatDisplayName, createNewMessage,
    addMessageToChat, sendTypingIndicator, joinChannel, leaveChannel,
    addReaction, loadMessages, updateMessageReactions, updateTypingUsers,
    updateUnreadCounts, updateOnlineUsers, playNotificationSound,
    getInitialMessagesForChat
} from '../helpers/utility.jsx'

function Dashboard() {
    const navigate = useNavigate()

    const [activeChat, setActiveChat] = useState('general')
    const [allMessages, setAllMessages] = useState({})
    const [username, setUsername] = useState('')
    const [connectionStatus, setConnectionStatus] = useState('connecting')
    const [channels, setChannels] = useState([])
    const [directMessages, setDirectMessages] = useState([])
    const [typingUsers, setTypingUsers] = useState({})
    const [unreadCounts, setUnreadCounts] = useState({})
    const [onlineUsers, setOnlineUsers] = useState({})
    const [showQuickSwitcher, setShowQuickSwitcher] = useState(false)

    const socketRef = useRef(null)
    const isConnectingRef = useRef(false)

    const activeMessages = allMessages[activeChat] || []
    const chatDisplayName = getChatDisplayName(activeChat, channels, directMessages)
    const activeTypingUsers = typingUsers[activeChat] || []

    useEffect(() => {
        if (isConnectingRef.current) return
        isConnectingRef.current = true

        initializeChat()

        const handleKeyPress = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                setShowQuickSwitcher(true)
            } else if (e.key === 'Escape' && showQuickSwitcher) {
                setShowQuickSwitcher(false)
            }
        }

        document.addEventListener('keydown', handleKeyPress)

        return () => {
            document.removeEventListener('keydown', handleKeyPress)
            if (socketRef.current) {
                socketRef.current.disconnect()
            }
            isConnectingRef.current = false
        }
    }, [navigate])

    const initializeChat = () => {
        const { username: storedUsername, initialMessages, channels, directMessages } = initializeDashboardData()
        setUsername(storedUsername)
        setAllMessages(initialMessages)
        setChannels(channels)
        setDirectMessages(directMessages)
        setOnlineUsers({
            'erik_ai': { username: 'erik_ai', status: 'online' },
            'sarah_chen': { username: 'Sarah Chen', status: 'online' }
        })

        connectToSocket()
    }

    const connectToSocket = () => {
        const socket = connectWebSocket((status, socketInstance) => {
            setConnectionStatus(status)

            if (status === 'connected' && socketInstance) {
                if (socketRef.current && socketRef.current.id !== socketInstance.id) {
                    socketRef.current.disconnect()
                }

                socketRef.current = socketInstance
                setupSocketHandlers(socketInstance)
                joinChannel(socketInstance, activeChat)
                loadInitialMessages()
                simulateDemoActivity()
            } else if (status === 'auth_error' || status === 'token_expired') {
                handleLogout(null, navigate)
            }
        })
    }

    const setupSocketHandlers = (socket) => {
        setupWebSocketHandlers(socket, {
            onMessage: handleIncomingMessage,
            onConnectionResponse: (data) => {},
            onTypingUpdate: (data) => {
                setTypingUsers(prev => updateTypingUsers(prev, data.channel_id, data.typing_users))
            },
            onPresenceUpdate: (data) => {
                setOnlineUsers(prev => ({
                    ...updateOnlineUsers(data.online_users),
                    'erik_ai': { username: 'erik_ai', status: 'online' }
                }))
            },
            onReactionUpdate: (data) => {
                updateReaction(data)
            },
            onMessagesRead: (data) => {
                handleMessagesRead(data)
            }
        })
    }

    const simulateDemoActivity = () => {
        setTimeout(() => {
            setTypingUsers(prev => ({
                ...prev,
                general: ['Sarah Chen']
            }))

            setTimeout(() => {
                setTypingUsers(prev => ({
                    ...prev,
                    general: []
                }))

                const newMessage = {
                    id: `demo-${Date.now()}`,
                    channel_id: 'general',
                    user: 'Sarah Chen',
                    user_id: 'sarah_chen',
                    text: 'Just pushed the new update! Check it out 🚀',
                    timestamp: new Date().toISOString(),
                    reactions: {}
                }

                handleIncomingMessage(newMessage)
            }, 3000)
        }, 3000)
    }

    const loadInitialMessages = async () => {
        const data = await loadMessages(activeChat)
        if (data.success && data.messages.length > 0) {
            setAllMessages(prev => ({ ...prev, [activeChat]: data.messages }))
            setUnreadCounts(data.unread_counts || {})
        } else {
            const initialMsgs = getInitialMessagesForChat(activeChat, username)
            if (initialMsgs.length > 0) {
                setAllMessages(prev => ({ ...prev, [activeChat]: initialMsgs }))
            }
        }
    }

    const handleChatSelect = (chatId) => {
        if (socketRef.current) {
            leaveChannel(socketRef.current, activeChat)
            joinChannel(socketRef.current, chatId)
        }
        setActiveChat(chatId)
        loadMessagesForChat(chatId)
    }

    const loadMessagesForChat = async (chatId) => {
        const data = await loadMessages(chatId)
        if (data.success && data.messages.length > 0) {
            setAllMessages(prev => ({ ...prev, [chatId]: data.messages }))
            setUnreadCounts(data.unread_counts || {})
        } else {
            const initialMsgs = getInitialMessagesForChat(chatId, username)
            if (initialMsgs.length > 0) {
                setAllMessages(prev => ({ ...prev, [chatId]: initialMsgs }))
            }
        }
    }

    const handleIncomingMessage = (data) => {
        setAllMessages(prev => addMessageToChat(prev, data.channel_id, data))

        if (data.channel_id !== activeChat) {
            setUnreadCounts(prev => ({
                ...prev,
                [data.channel_id]: (prev[data.channel_id] || 0) + 1
            }))

            const isDM = !['general', 'random', 'tech', 'gaming'].includes(data.channel_id)
            playNotificationSound(isDM ? 'dm' : 'message')
        }
    }

    const handleSendMessage = (text) => {
        const newMessage = createNewMessage(username, text)
        setAllMessages(prev => addMessageToChat(prev, activeChat, newMessage))

        const sent = sendMessage(socketRef.current, activeChat, text, connectionStatus)
        if (sent && activeChat === 'erik_ai') {
            setTypingUsers(prev => ({
                ...prev,
                erik_ai: ['erik_ai']
            }))

            setTimeout(() => {
                setTypingUsers(prev => ({
                    ...prev,
                    erik_ai: []
                }))
            }, 2000)
        }
    }

    const handleTyping = (isTyping) => {
        if (socketRef.current) {
            sendTypingIndicator(socketRef.current, activeChat, isTyping)
        }
    }

    const handleAddReaction = (messageId, emoji) => {
        if (socketRef.current) {
            addReaction(socketRef.current, messageId, emoji)
        }
    }

    const updateReaction = (data) => {
        setAllMessages(prev => ({
            ...prev,
            [activeChat]: updateMessageReactions(prev[activeChat] || [], data.message_id, data.reactions)
        }))
    }

    const handleMessagesRead = (data) => {
        setAllMessages(prev => ({
            ...prev,
            [data.channel_id]: (prev[data.channel_id] || []).map(msg =>
                msg.user_id === username ? { ...msg, is_read: true } : msg
            )
        }))
    }

    return (
        <div className="chat-container">
            <StarryBackground />

            {showQuickSwitcher && (
                <div className="quick-switcher-overlay" onClick={() => setShowQuickSwitcher(false)}>
                    <div className="quick-switcher" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="text"
                            placeholder="Jump to channel or DM..."
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.value) {
                                    const target = e.target.value.toLowerCase()
                                    const allChats = [...channels, ...directMessages]
                                    const match = allChats.find(chat =>
                                        chat.name.toLowerCase().includes(target) ||
                                        chat.id.toLowerCase().includes(target)
                                    )
                                    if (match && !match.disabled) {
                                        handleChatSelect(match.id)
                                        setShowQuickSwitcher(false)
                                    }
                                }
                            }}
                        />
                        <div className="quick-switcher-hint">Press ESC to close</div>
                    </div>
                </div>
            )}

            <ChatSidebar
                activeChat={activeChat}
                onChatSelect={handleChatSelect}
                channels={channels}
                directMessages={directMessages}
                onLogout={() => handleLogout(socketRef.current, navigate)}
                username={username}
                unreadCounts={unreadCounts}
                onlineUsers={{
                    ...onlineUsers,
                    'erik_ai': { username: 'erik_ai', status: 'online' }
                }}
            />

            <ChatMain
                activeChat={activeChat}
                messages={activeMessages}
                onSendMessage={handleSendMessage}
                currentUser={username}
                chatDisplayName={chatDisplayName}
                typingUsers={activeTypingUsers}
                onTyping={handleTyping}
                connectionStatus={connectionStatus}
                onAddReaction={handleAddReaction}
            />
        </div>
    )
}

export default Dashboard