import React, { useState, useEffect, useRef } from 'react'
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
        <div className="logo-circle">
            <span>CT</span>
        </div>
    )
}

export function StarryBackground({ isDarkMode = false }) {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const stars = []
        const starCount = isDarkMode ? 400 : 800

        for (let i = 0; i < starCount; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 0.8 + 0.2,
                brightness: isDarkMode ? Math.random() * 0.3 + 0.1 : Math.random() * 0.5 + 0.3,
                twinkleSpeed: Math.random() * 0.015 + 0.005
            })
        }

        const animate = () => {
            ctx.fillStyle = isDarkMode ? '#000000' : '#000000'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            stars.forEach(star => {
                ctx.beginPath()
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`
                ctx.fill()

                star.brightness += (Math.random() - 0.5) * star.twinkleSpeed
                star.brightness = Math.max(0.1, Math.min(isDarkMode ? 0.4 : 0.8, star.brightness))
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
    }, [isDarkMode])

    return (
        <canvas
            ref={canvasRef}
            className="starry-messages"
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
export function ChatSidebar({ activeChat, onChatSelect, channels, directMessages, onLogout, username }) {
    const userInitial = username ? username[0].toUpperCase() : 'U'

    return (
        <div className="chat-sidebar">
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
                isChannel={true}
            />

            <ChatSection
                title="Direct Messages"
                items={directMessages}
                activeId={activeChat}
                onSelect={onChatSelect}
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

function ChatSection({ title, items, activeId, onSelect, showAdd, isDM, isChannel }) {
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
                        onClick={() => !item.disabled && onSelect(item.id)}
                        isDM={isDM}
                        isChannel={isChannel}
                    />
                ))}
            </div>
        </div>
    )
}

function ChatItem({ item, isActive, onClick, isDM, isChannel }) {
    const initial = item.name ? item.name[0].toUpperCase() : '?'

    return (
        <div
            className={`channel-item ${isActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={onClick}
        >
            {isChannel && <span className="channel-prefix">#</span>}
            {isDM && (
                <div className="dm-avatar">
                    {initial}
                </div>
            )}
            <span className="channel-name">{item.name}</span>
        </div>
    )
}

export function ChatMain({ activeChat, messages, onSendMessage, currentUser, chatDisplayName }) {
    const [messageText, setMessageText] = useState('')
    const messagesEndRef = useRef(null)
    const [lastTimeShown, setLastTimeShown] = useState(null)

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

    const isDM = activeChat && (activeChat.startsWith('erik') || !['general', 'random', 'tech', 'gaming'].includes(activeChat))
    const placeholder = isDM ? `Message ${chatDisplayName}` : `Message #${chatDisplayName}`

    return (
        <div className="chat-main">
            <MessageList
                messages={messages}
                currentUser={currentUser}
                lastTimeShown={lastTimeShown}
                setLastTimeShown={setLastTimeShown}
            />
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

function MessageList({ messages, currentUser, lastTimeShown, setLastTimeShown }) {
    const parseTime = (timeStr) => {
        const [time, period] = timeStr.split(' ')
        const [hours, minutes] = time.split(':').map(Number)
        let hour24 = hours
        if (period === 'PM' && hours !== 12) hour24 += 12
        if (period === 'AM' && hours === 12) hour24 = 0
        return hour24 * 60 + minutes
    }

    const shouldShowTime = (currentTime, lastTime) => {
        if (!lastTime) return true
        const currentMinutes = parseTime(currentTime)
        const lastMinutes = parseTime(lastTime)
        return Math.abs(currentMinutes - lastMinutes) > 60 // Show time if more than 1 hour gap
    }

    return (
        <div className="messages-container">
            <StarryBackground isDarkMode={true} />
            {messages.map((msg, index) => {
                const showTime = shouldShowTime(msg.time, index > 0 ? messages[index - 1].time : null)

                return (
                    <React.Fragment key={msg.id}>
                        {showTime && !msg.isSystem && (
                            <div className="time-separator">
                                <span>{msg.time}</span>
                            </div>
                        )}
                        <Message message={msg} currentUser={currentUser} />
                    </React.Fragment>
                )
            })}
        </div>
    )
}

function Message({ message, currentUser }) {
    const isOwn = message.user === currentUser
    const isSystem = message.isSystem

    if (isSystem) {
        return (
            <div className="system-message">
                <span className="message-text">{message.text}</span>
            </div>
        )
    }

    return (
        <div className={`chat-message ${isOwn ? 'own-message' : ''}`}>
            {!isOwn && (
                <div className="message-avatar">
                    {message.user[0].toUpperCase()}
                </div>
            )}
            <div className="message-wrapper">
                <div className="message-bubble">
                    <div className="message-text">{message.text}</div>
                </div>
                <div className="message-sender">{message.user}</div>
            </div>
        </div>
    )
}

export { AuthForm, MessageDisplay, BackButton }