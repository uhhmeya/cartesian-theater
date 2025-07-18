import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRelativeTime } from './utility.jsx'

const debug = (component, message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    const prefix = `[${timestamp}] COMPONENT ${component}:`
    if (data) {
        console.log(prefix, message, data)
    } else {
        console.log(prefix, message)
    }
}

function AuthForm({ onSubmit, submitText, isLoading = false }) {
    const [user, setUser] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        if (!isLoading) {
            onSubmit({ user, password })
        }
    }

    return (
        <form onSubmit={handleSubmit} className="auth-form">
            <input
                type="text"
                placeholder="Username"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                required
                disabled={isLoading}
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
            />
            <button type="submit" className="btn-primary" disabled={isLoading}>
                {isLoading ? 'Loading...' : submitText}
            </button>
        </form>
    )
}

function MessageDisplay({ message, onClose, type = "info" }) {
    if (!message) return null

    return (
        <div className={`message message--${type}`}>
            <div className="message__content">
                {message}
            </div>
            <button
                className="message__close"
                onClick={onClose}
                aria-label="Close message"
            >
                ×
            </button>
        </div>
    )
}

function BackButton({ to = "/", text = "Back" }) {
    const navigate = useNavigate()

    return (
        <button
            className="back-button"
            onClick={() => navigate(to)}
        >
            ← {text}
        </button>
    )
}

export function TextLogo() {
    return (
        <div className="logo-circle">
            <span>CT</span>
        </div>
    )
}

export function StarryBackground() {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const stars = []
        const starCount = 800

        for (let i = 0; i < starCount; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 1 + 0.2,
                brightness: Math.random() * 0.5 + 0.3,
                twinkleSpeed: Math.random() * 0.015 + 0.005
            })
        }

        const animate = () => {
            ctx.fillStyle = '#0a0a0a'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            stars.forEach(star => {
                ctx.beginPath()
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`
                ctx.fill()

                star.brightness += (Math.random() - 0.5) * star.twinkleSpeed
                star.brightness = Math.max(0.1, Math.min(0.8, star.brightness))
            })

            requestAnimationFrame(animate)
        }

        animate()

        const handleResize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }

        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0
            }}
        />
    )
}

export function ChatSidebar({ activeChat, onChatSelect, channels, directMessages, onLogout, username, unreadCounts, onlineUsers }) {
    const [isResizing, setIsResizing] = useState(false)
    const [sidebarWidth, setSidebarWidth] = useState(240)
    const sidebarRef = useRef(null)

    console.log('[SIDEBAR] Rendering', {
        activeChat,
        unreadCounts,
        onlineUsersCount: Object.keys(onlineUsers || {}).length
    })

    const handleMouseDown = (e) => {
        setIsResizing(true)
        e.preventDefault()
    }

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return
            const newWidth = e.clientX
            if (newWidth >= 180 && newWidth <= 350) {
                setSidebarWidth(newWidth)
            }
        }

        const handleMouseUp = () => {
            setIsResizing(false)
        }

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing])

    const userInitial = username ? username[0].toUpperCase() : 'U'

    return (
        <div className="chat-sidebar" ref={sidebarRef} style={{ width: sidebarWidth }}>
            <div className="sidebar-resize" onMouseDown={handleMouseDown}></div>

            <div className="sidebar-header">
                <h2>
                    <TextLogo />
                    Cartesian Theater
                </h2>
                <div className="user-menu">
                    <div className="user-profile">
                        {userInitial}
                        <div className="user-status online"></div>
                    </div>
                    <span>{username || 'User'}</span>
                </div>
            </div>

            <ChatSection
                title="Chatrooms"
                items={channels}
                activeId={activeChat}
                onSelect={onChatSelect}
                showAdd={true}
                unreadCounts={unreadCounts}
            />

            <ChatSection
                title="Direct Messages"
                items={directMessages}
                activeId={activeChat}
                onSelect={onChatSelect}
                isDM={true}
                unreadCounts={unreadCounts}
                onlineUsers={onlineUsers}
            />

            <div className="sidebar-footer">
                <button className="logout-button" onClick={onLogout}>
                    <span>←</span> Logout
                </button>
            </div>
        </div>
    )
}

function ChatSection({ title, items, activeId, onSelect, showAdd, isDM, unreadCounts, onlineUsers }) {
    return (
        <div className="channel-section">
            <div className="section-header">
                <span>{title}</span>
                {showAdd && <button className="add-button">+</button>}
            </div>
            <div className="channel-list">
                {items.map(item => (
                    <ChatItem
                        key={item.id}
                        item={item}
                        isActive={activeId === item.id}
                        onClick={() => {
                            console.log('[CHAT] Selecting chat:', item.id)
                            if (!item.disabled) onSelect(item.id)
                        }}
                        isDM={isDM}
                        unreadCount={unreadCounts?.[item.id] || 0}
                        isOnline={isDM && onlineUsers?.[item.id]?.status === 'online'}
                    />
                ))}
            </div>
        </div>
    )
}

function ChatItem({ item, isActive, onClick, isDM, unreadCount, isOnline }) {
    const initial = item.name ? item.name[0].toUpperCase() : '?'

    return (
        <div
            className={`channel-item ${isActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={onClick}
        >
            {isDM ? (
                <div className="dm-avatar">
                    {initial}
                    {isOnline && <div className="user-status online"></div>}
                </div>
            ) : (
                <span className="channel-prefix">#</span>
            )}
            <span className="channel-name">{item.name}</span>
            {unreadCount > 0 && (
                <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
        </div>
    )
}

export function ChatMain({ activeChat, messages, onSendMessage, currentUser, chatDisplayName, typingUsers, onTyping, connectionStatus, onAddReaction }) {
    const [messageText, setMessageText] = useState('')
    const messagesEndRef = useRef(null)
    const typingTimeoutRef = useRef(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }
        }
    }, [])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (messageText.trim()) {
            console.log('[CHAT] Sending message:', messageText)
            onSendMessage(messageText)
            setMessageText('')
            if (onTyping) onTyping(false)
        }
    }

    const handleInputChange = (e) => {
        setMessageText(e.target.value)

        if (onTyping && e.target.value.trim()) {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
            }

            onTyping(true)

            typingTimeoutRef.current = setTimeout(() => {
                onTyping(false)
            }, 1500)
        }
    }

    const isDM = activeChat && (activeChat.includes('_') || !['general', 'random', 'tech', 'gaming'].includes(activeChat))
    const placeholder = isDM ? `Message ${chatDisplayName}` : `Message #${chatDisplayName}`

    const getStatusColor = () => {
        switch(connectionStatus) {
            case 'connected': return 'bg-green-500'
            case 'connecting': return 'bg-yellow-500'
            case 'disconnected': return 'bg-red-500'
            default: return 'bg-gray-500'
        }
    }

    console.log('[CHAT] Rendering ChatMain', {
        activeChat,
        messageCount: messages.length,
        connectionStatus,
        typingUsers: typingUsers?.length || 0
    })

    return (
        <div className="chat-main">
            {connectionStatus !== 'connected' && (
                <div className={`connection-status-bar ${getStatusColor()}`}>
                    {connectionStatus === 'connecting' ? 'Connecting...' :
                        connectionStatus === 'disconnected' ? 'Disconnected - Attempting to reconnect...' :
                            'Connection error'}
                </div>
            )}

            <div className="chat-header">
                <h3>{isDM ? chatDisplayName : `#${chatDisplayName}`}</h3>
                <div className="header-actions">
                    <button className="header-button">⚙️</button>
                </div>
            </div>

            <MessageList
                messages={messages}
                currentUser={currentUser}
                onAddReaction={onAddReaction}
            />

            {typingUsers && typingUsers.length > 0 && (
                <div className="typing-indicator">
                    <div className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <span>{typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...</span>
                </div>
            )}

            <div ref={messagesEndRef} />

            <form className="message-input-container" onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="message-input"
                    placeholder={placeholder}
                    value={messageText}
                    onChange={handleInputChange}
                    disabled={connectionStatus !== 'connected'}
                />
                <button
                    type="submit"
                    className="send-button"
                    disabled={connectionStatus !== 'connected' || !messageText.trim()}
                >
                    Send
                </button>
            </form>
        </div>
    )
}

function MessageList({ messages, currentUser, onAddReaction }) {
    console.log('[MESSAGES] Rendering message list', { count: messages.length })

    return (
        <div className="messages-container">
            {messages.map(msg => (
                <Message
                    key={msg.id}
                    message={msg}
                    currentUser={currentUser}
                    onAddReaction={onAddReaction}
                />
            ))}
        </div>
    )
}

function Message({ message, currentUser, onAddReaction }) {
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const isOwn = message.user === currentUser
    const isSystem = message.isSystem
    const messageClass = `chat-message ${isSystem ? 'system-message' : ''} ${isOwn ? 'own-message' : ''}`
    const initial = message.user ? message.user[0].toUpperCase() : '?'

    const handleReaction = (emoji) => {
        console.log('[REACTION] Adding reaction', { messageId: message.id, emoji })
        if (onAddReaction) {
            onAddReaction(message.id, emoji)
        }
        setShowEmojiPicker(false)
    }

    if (isSystem) {
        return (
            <div className={messageClass}>
                <span className="message-text">{message.text}</span>
            </div>
        )
    }

    return (
        <div className={messageClass}>
            {!isOwn && (
                <div className="message-avatar">
                    {initial}
                </div>
            )}
            <div className="message-wrapper">
                <div className="message-bubble" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                    <div className="message-text">{message.text}</div>
                    {isOwn && message.is_read && (
                        <span className="read-receipt">Read</span>
                    )}
                    {showEmojiPicker && (
                        <div className="emoji-picker">
                            {['👍', '❤️', '😄', '😮', '😢', '🎉'].map(emoji => (
                                <button
                                    key={emoji}
                                    className="emoji-option"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleReaction(emoji)
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {!isOwn && <div className="message-sender">{message.user}</div>}
                <span className="message-time">{message.timestamp ? getRelativeTime(message.timestamp) : message.time}</span>
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className="message-reactions">
                        {Object.entries(message.reactions).map(([emoji, users]) => (
                            <button
                                key={emoji}
                                className="reaction-button"
                                onClick={() => handleReaction(emoji)}
                            >
                                {emoji} {users.length}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export { AuthForm, MessageDisplay, BackButton }