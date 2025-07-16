import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

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
        <span style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#991b1b',
            letterSpacing: '-0.02em'
        }}>
            CT
        </span>
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

// Chat Components
export function ChatSidebar({ activeChannel, onChannelSelect, channels, directMessages, onLogout, sidebarWidth, username }) {
    const [isResizing, setIsResizing] = useState(false)
    const sidebarRef = useRef(null)

    const handleMouseDown = (e) => {
        setIsResizing(true)
        e.preventDefault()
    }

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return
            const newWidth = e.clientX
            if (newWidth >= 180 && newWidth <= 350) {
                sidebarRef.current.style.width = `${newWidth}px`
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

            <ChannelSection
                title="Chatrooms"
                items={channels}
                activeId={activeChannel}
                onSelect={onChannelSelect}
                showAdd={true}
            />

            <ChannelSection
                title="Direct Messages"
                items={directMessages}
                activeId={activeChannel}
                onSelect={onChannelSelect}
                isDM={true}
            />

            <div className="sidebar-footer">
                <button className="logout-button" onClick={onLogout}>
                    <span>←</span> Logout
                </button>
            </div>
        </div>
    )
}

function ChannelSection({ title, items, activeId, onSelect, showAdd, isDM }) {
    return (
        <div className="channel-section">
            <div className="section-header">
                <span>{title}</span>
                {showAdd && <button className="add-button">+</button>}
            </div>
            <div className="channel-list">
                {items.map(item => (
                    <ChannelItem
                        key={item.id}
                        item={item}
                        isActive={activeId === item.id}
                        onClick={() => !item.disabled && onSelect(item.id)}
                        isDM={isDM}
                    />
                ))}
            </div>
        </div>
    )
}

function ChannelItem({ item, isActive, onClick, isDM }) {
    const initial = item.name ? item.name[0].toUpperCase() : '?'

    return (
        <div
            className={`channel-item ${isActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={onClick}
        >
            <div className={`channel-avatar ${!isDM ? 'group' : ''}`}>
                {initial}
            </div>
            <span className="channel-name">{item.name}</span>
        </div>
    )
}

export function ChatMain({ activeChannel, messages, onSendMessage, currentUser, channelName }) {
    const [messageText, setMessageText] = useState('')
    const messagesEndRef = useRef(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const handleSubmit = (e) => {
        e.preventDefault()
        if (messageText.trim()) {
            onSendMessage(messageText)
            setMessageText('')
        }
    }

    const isDM = activeChannel && (activeChannel.startsWith('erik') || !['general', 'random', 'tech', 'gaming'].includes(activeChannel))
    const placeholder = isDM ? `Message ${channelName}` : `Message #${channelName}`

    return (
        <div className="chat-main">
            <div className="chat-header">
                <h3>{isDM ? channelName : `#${channelName}`}</h3>
                <div className="header-actions">
                    <button className="header-button">⚙️</button>
                </div>
            </div>

            <MessageList messages={messages} currentUser={currentUser} />
            <div ref={messagesEndRef} />

            <form className="message-input-container" onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="message-input"
                    placeholder={placeholder}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                />
                <button type="submit" className="send-button">Send</button>
            </form>
        </div>
    )
}

function MessageList({ messages, currentUser }) {
    return (
        <div className="messages-container">
            {messages.map(msg => (
                <Message key={msg.id} message={msg} currentUser={currentUser} />
            ))}
        </div>
    )
}

function Message({ message, currentUser }) {
    const isOwn = message.user === currentUser
    const isSystem = message.isSystem
    const messageClass = `chat-message ${isSystem ? 'system-message' : ''} ${isOwn ? 'own-message' : ''}`
    const initial = message.user ? message.user[0].toUpperCase() : '?'

    if (isSystem) {
        return (
            <div className={messageClass}>
                <div className="message-bubble">
                    <div className="message-text">{message.text}</div>
                </div>
            </div>
        )
    }

    return (
        <div className={messageClass}>
            <div className="message-avatar">
                {initial}
            </div>
            <div className="message-bubble">
                <div className="message-header">
                    <span className="message-user">{message.user}</span>
                    <span className="message-time">{message.time}</span>
                </div>
                <div className="message-text">{message.text}</div>
            </div>
        </div>
    )
}

export { AuthForm, MessageDisplay, BackButton }