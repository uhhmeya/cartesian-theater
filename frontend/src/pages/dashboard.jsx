import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { StarryBackground, ChatSidebar, ChatMain } from '../helpers/components.jsx'
import {
    connectWebSocket,
    setupWebSocketHandlers,
    handleLogout,
    sendMessage,
    initializeDashboardData,
    getChatDisplayName,
    createNewMessage,
    addMessageToChat,
    sendTypingIndicator,
    joinChannel,
    leaveChannel,
    addReaction,
    loadMessages,
    updateMessageReactions,
    updateTypingUsers,
    updateUnreadCounts,
    updateOnlineUsers,
    playNotificationSound,
    getInitialMessagesForChat
} from '../helpers/utility.jsx'

const debug = (category, message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    const prefix = `[${timestamp}] DASHBOARD ${category}:`
    if (data) {
        console.log(prefix, message, data)
    } else {
        console.log(prefix, message)
    }
}

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

    const socketRef = useRef(null)
    const isConnectingRef = useRef(false)

    const [showQuickSwitcher, setShowQuickSwitcher] = useState(false)

    const activeMessages = allMessages[activeChat] || []
    const chatDisplayName = getChatDisplayName(activeChat, channels, directMessages)
    const activeTypingUsers = typingUsers[activeChat] || []

    debug('🎨 RENDER', 'Dashboard rendering', {
        activeChat,
        chatDisplayName,
        messageCount: activeMessages.length,
        connectionStatus,
        typingUsersCount: activeTypingUsers.length
    })

    useEffect(() => {
        debug('🚀 INIT', 'Dashboard component mounting')

        // Prevent duplicate connections
        if (isConnectingRef.current) {
            debug('⚠️ INIT', 'Already connecting, skipping...')
            return
        }
        isConnectingRef.current = true

        const { username: storedUsername, initialMessages, channels, directMessages } = initializeDashboardData()
        setUsername(storedUsername)
        setAllMessages(initialMessages)
        setChannels(channels)
        setDirectMessages(directMessages)

        // Set initial online status for AI and demo users
        setOnlineUsers({
            'erik_ai': { username: 'erik_ai', status: 'online' },
            'sarah_chen': { username: 'Sarah Chen', status: 'online' }
        })

        debug('📊 INIT', 'Initial data loaded', {
            username: storedUsername,
            channelCount: channels.length,
            dmCount: directMessages.length
        })

        const socket = connectWebSocket((status, socketInstance) => {
            debug('🔌 SOCKET', `Connection status changed: ${status}`)
            setConnectionStatus(status)

            if (status === 'connected' && socketInstance) {
                // Disconnect any existing socket
                if (socketRef.current && socketRef.current.id !== socketInstance.id) {
                    debug('🔌 SOCKET', 'Disconnecting duplicate socket')
                    socketRef.current.disconnect()
                }

                socketRef.current = socketInstance
                debug('✅ SOCKET', 'Socket connected successfully', { id: socketInstance.id })

                setupWebSocketHandlers(socketInstance, {
                    onMessage: handleIncomingMessage,
                    onConnectionResponse: (data) => {
                        debug('📨 SOCKET', 'Connection response received', data)
                    },
                    onTypingUpdate: (data) => {
                        debug('⌨️ TYPING', 'Typing update received', data)
                        setTypingUsers(prev => updateTypingUsers(prev, data.channel_id, data.typing_users))
                    },
                    onPresenceUpdate: (data) => {
                        debug('👥 PRESENCE', 'Presence update received', {
                            userCount: Object.keys(data.online_users).length
                        })
                        // Preserve AI online status
                        setOnlineUsers(prev => ({
                            ...updateOnlineUsers(data.online_users),
                            'erik_ai': { username: 'erik_ai', status: 'online' }
                        }))
                    },
                    onReactionUpdate: (data) => {
                        debug('😀 REACTION', 'Reaction update received', data)
                        updateReaction(data)
                    },
                    onMessagesRead: (data) => {
                        debug('✅ READ', 'Messages read update received', data)
                        handleMessagesRead(data)
                    }
                })

                joinChannel(socketInstance, activeChat)
                loadInitialMessages()

                // Demo typing indicator for Sarah Chen
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
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            timestamp: new Date().toISOString(),
                            reactions: {}
                        }

                        handleIncomingMessage(newMessage)
                    }, 3000)
                }, 3000)
            } else if (status === 'auth_error' || status === 'token_expired') {
                debug('❌ AUTH', 'Authentication failed, redirecting to login')
                handleLogout(null, navigate)
            }
        })

        const handleKeyPress = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                debug('⌨️ SHORTCUT', 'Quick switcher activated (Ctrl+K)')
                setShowQuickSwitcher(true)
            } else if (e.key === 'Escape' && showQuickSwitcher) {
                setShowQuickSwitcher(false)
            }
        }

        document.addEventListener('keydown', handleKeyPress)

        return () => {
            debug('🧹 CLEANUP', 'Dashboard component unmounting')
            document.removeEventListener('keydown', handleKeyPress)
            if (socketRef.current) {
                socketRef.current.disconnect()
                debug('🔌 CLEANUP', 'Socket disconnected')
            }
            isConnectingRef.current = false
        }
    }, [navigate])

    const loadInitialMessages = async () => {
        debug('📥 MESSAGES', `Loading initial messages for channel: ${activeChat}`)
        const data = await loadMessages(activeChat)
        if (data.success && data.messages.length > 0) {
            debug('✅ MESSAGES', `Loaded ${data.messages.length} messages`)
            setAllMessages(prev => ({ ...prev, [activeChat]: data.messages }))
            setUnreadCounts(data.unread_counts || {})
        } else {
            debug('❌ MESSAGES', 'No messages from database, using initial messages')
            const initialMsgs = getInitialMessagesForChat(activeChat, username)
            if (initialMsgs.length > 0) {
                setAllMessages(prev => ({ ...prev, [activeChat]: initialMsgs }))
            }
        }
    }

    const handleChatSelect = (chatId) => {
        debug('💬 CHAT', `Switching to chat: ${chatId}`)

        if (socketRef.current) {
            leaveChannel(socketRef.current, activeChat)
            joinChannel(socketRef.current, chatId)
        }
        setActiveChat(chatId)
        loadMessagesForChat(chatId)
    }

    const loadMessagesForChat = async (chatId) => {
        debug('📥 MESSAGES', `Loading messages for chat: ${chatId}`)
        const data = await loadMessages(chatId)
        if (data.success && data.messages.length > 0) {
            debug('✅ MESSAGES', `Loaded ${data.messages.length} messages for ${chatId}`)
            setAllMessages(prev => ({ ...prev, [chatId]: data.messages }))
            setUnreadCounts(data.unread_counts || {})
        } else {
            debug('❌ MESSAGES', `No messages for ${chatId}, using initial messages`)
            const initialMsgs = getInitialMessagesForChat(chatId, username)
            if (initialMsgs.length > 0) {
                setAllMessages(prev => ({ ...prev, [chatId]: initialMsgs }))
            }
        }
    }

    const handleIncomingMessage = (data) => {
        debug('💬 INCOMING', 'New message received', data)
        setAllMessages(prev => addMessageToChat(prev, data.channel_id, data))

        if (data.channel_id !== activeChat) {
            debug('🔔 UNREAD', `Incrementing unread count for ${data.channel_id}`)
            setUnreadCounts(prev => ({
                ...prev,
                [data.channel_id]: (prev[data.channel_id] || 0) + 1
            }))

            const isDM = !['general', 'random', 'tech', 'gaming'].includes(data.channel_id)
            playNotificationSound(isDM ? 'dm' : 'message')
        }
    }

    const handleSendMessage = (text) => {
        debug('📤 SEND', `Sending message: ${text.substring(0, 50)}...`)
        const newMessage = createNewMessage(username, text)
        setAllMessages(prev => addMessageToChat(prev, activeChat, newMessage))

        const sent = sendMessage(socketRef.current, activeChat, text, connectionStatus)
        if (sent) {
            debug('✅ SEND', 'Message sent successfully')

            // Show typing indicator for AI if in erik_ai channel
            if (activeChat === 'erik_ai') {
                debug('🤖 AI', 'AI is typing...')
                setTypingUsers(prev => ({
                    ...prev,
                    erik_ai: ['erik_ai']
                }))

                // Clear typing indicator after 2 seconds
                setTimeout(() => {
                    setTypingUsers(prev => ({
                        ...prev,
                        erik_ai: []
                    }))
                }, 2000)
            }
        } else {
            debug('❌ SEND', 'Failed to send message')
        }
    }

    const handleTyping = (isTyping) => {
        debug('⌨️ TYPING', `Typing status: ${isTyping}`)
        if (socketRef.current) {
            sendTypingIndicator(socketRef.current, activeChat, isTyping)
        }
    }

    const handleAddReaction = (messageId, emoji) => {
        debug('😀 REACTION', `Adding reaction ${emoji} to message ${messageId}`)
        if (socketRef.current) {
            addReaction(socketRef.current, messageId, emoji)
        }
    }

    const updateReaction = (data) => {
        debug('😀 UPDATE', 'Updating reactions', data)
        setAllMessages(prev => ({
            ...prev,
            [activeChat]: updateMessageReactions(prev[activeChat] || [], data.message_id, data.reactions)
        }))
    }

    const handleMessagesRead = (data) => {
        debug('✅ READ', `Marking messages as read in ${data.channel_id}`)
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
                onLogout={() => {
                    debug('👋 LOGOUT', 'User logging out')
                    handleLogout(socketRef.current, navigate)
                }}
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