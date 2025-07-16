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

export function GlitchLogo({ src, alt = "Logo" }) {
    return (
        <div className="logo-glitch">
            <img src={src} alt={alt} />
        </div>
    )
}

export function SimpleLogo() {
    return <span className="logo-fallback">👻</span>
}

export function TextLogo() {
    return (
        <span style={{
            fontSize: '30px',
            fontWeight: 'bold',
            color: '#dc143c',
            textShadow: '0 0 10px rgba(220, 20, 60, 0.8)'
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
        const starCount = 1500

        for (let i = 0; i < starCount; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 1.2 + 0.3,
                brightness: Math.random() * 0.6 + 0.4,
                twinkleSpeed: Math.random() * 0.02 + 0.01
            })
        }

        const animate = () => {
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.imageSmoothingEnabled = false

            stars.forEach(star => {
                ctx.beginPath()
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`
                ctx.fill()

                star.brightness += (Math.random() - 0.5) * star.twinkleSpeed
                star.brightness = Math.max(0.2, Math.min(1, star.brightness))
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

export const animationStyles = `
    @keyframes glitchAnim {
        0%, 100% {
            transform: translate(0) skew(0deg);
        }
        20% {
            transform: translate(-0.5px, 0.5px) skew(0.5deg);
        }
        40% {
            transform: translate(-0.5px, -0.5px) skew(-0.5deg);
        }
        60% {
            transform: translate(0.5px, 0.5px) skew(0.5deg);
        }
        80% {
            transform: translate(0.5px, -0.5px) skew(-0.5deg);
        }
    }

    @keyframes dataGlitch {
        0%, 85%, 100% {
            clip-path: inset(0 0 0 0);
        }
        87% {
            clip-path: inset(10% 0 85% 0);
        }
        90% {
            clip-path: inset(40% 0 45% 0);
        }
        93% {
            clip-path: inset(80% 0 5% 0);
        }
        96% {
            clip-path: inset(25% 0 60% 0);
        }
    }

    @keyframes rgbShift {
        0%, 100% {
            text-shadow: 
                0 0 0 transparent;
        }
        25% {
            text-shadow: 
                1px 0 0 rgba(0, 255, 136, 0.5),
                -1px 0 0 rgba(0, 255, 170, 0.5);
        }
        50% {
            text-shadow: 
                0 1px 0 rgba(0, 255, 136, 0.3),
                0 -1px 0 rgba(0, 255, 170, 0.3);
        }
        75% {
            text-shadow: 
                -1px 0 0 rgba(0, 255, 136, 0.5),
                1px 0 0 rgba(0, 255, 170, 0.5);
        }
    }

    .logo-container {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 15px;
    }

    .logo-glitch {
        width: 40px;
        height: 40px;
        position: relative;
        display: inline-block;
        filter: 
            drop-shadow(0 0 8px #dc143c) 
            drop-shadow(0 0 15px #dc143c)
            drop-shadow(0 0 25px #dc143c);
        animation: glitchAnim 3s infinite;
        transition: all 0.3s ease;
        cursor: pointer;
    }

    .logo-glitch::before,
    .logo-glitch::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0.8;
        pointer-events: none;
    }

    .logo-glitch::before {
        animation: dataGlitch 6s infinite;
        background: linear-gradient(45deg, transparent 40%, rgba(0, 255, 136, 0.2) 50%, transparent 60%);
        opacity: 0.2;
        transform: translateX(1px);
        mix-blend-mode: screen;
    }

    .logo-glitch::after {
        animation: dataGlitch 7s infinite reverse;
        background: linear-gradient(-45deg, transparent 40%, rgba(0, 255, 170, 0.2) 50%, transparent 60%);
        opacity: 0.2;
        transform: translateX(-1px);
        mix-blend-mode: screen;
    }

    .logo-glitch img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: 
            brightness(2)
            contrast(1.5)
            sepia(1)
            hue-rotate(90deg)
            saturate(2)
            drop-shadow(0 0 2px #00ff88)
            drop-shadow(0 0 4px #00ff88)
            drop-shadow(0 0 6px #00ff88);
        -webkit-filter:
            brightness(2)
            contrast(1.5)
            sepia(1)
            hue-rotate(90deg)
            saturate(2)
            drop-shadow(0 0 2px #00ff88)
            drop-shadow(0 0 4px #00ff88)
            drop-shadow(0 0 6px #00ff88);
        position: relative;
        z-index: 1;
        animation: glow 3s ease-in-out infinite;
    }

    .logo-glitch:hover {
        animation-duration: 1s;
        filter: 
            drop-shadow(0 0 10px #dc143c) 
            drop-shadow(0 0 20px #dc143c)
            drop-shadow(0 0 30px #dc143c);
    }

    .spark {
        position: absolute;
        width: 3px;
        height: 3px;
        background: radial-gradient(circle, #00ff88 0%, #00ffaa 50%, transparent 100%);
        border-radius: 50%;
        opacity: 0;
        animation: spark 3s infinite;
        filter: blur(0px);
        box-shadow: 
            0 0 5px #00ff88,
            0 0 10px #00ff88;
    }

    @keyframes spark {
        0% {
            opacity: 0;
            transform: translate(0, 0) scale(0);
        }
        20% {
            opacity: 0.6;
        }
        50% {
            opacity: 0.4;
            transform: translate(var(--x), var(--y)) scale(1);
        }
        100% {
            opacity: 0;
            transform: translate(calc(var(--x) * 1.5), calc(var(--y) * 1.5)) scale(0.3);
        }
    }

    .spark:nth-child(1) { --x: -20px; --y: -10px; animation-delay: 0s; }
    .spark:nth-child(2) { --x: 20px; --y: -10px; animation-delay: 1s; }
    .spark:nth-child(3) { --x: 0; --y: 20px; animation-delay: 2s; }

    .pulse {
        animation: pulse 4s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% {
            opacity: 0.8;
        }
        50% {
            opacity: 1;
        }
    }

    @keyframes glow {
        0%, 100% {
            filter: 
                brightness(2)
                contrast(1.5)
                sepia(1)
                hue-rotate(90deg)
                saturate(2)
                drop-shadow(0 0 2px #00ff88)
                drop-shadow(0 0 4px #00ff88)
                drop-shadow(0 0 6px #00ff88);
            -webkit-filter: 
                brightness(2)
                contrast(1.5)
                sepia(1)
                hue-rotate(90deg)
                saturate(2)
                drop-shadow(0 0 2px #00ff88)
                drop-shadow(0 0 4px #00ff88)
                drop-shadow(0 0 6px #00ff88);
        }
        50% {
            filter: 
                brightness(2.5)
                contrast(1.8)
                sepia(1)
                hue-rotate(90deg)
                saturate(2.5)
                drop-shadow(0 0 3px #00ff88)
                drop-shadow(0 0 6px #00ff88)
                drop-shadow(0 0 9px #00ff88);
            -webkit-filter: 
                brightness(2.5)
                contrast(1.8)
                sepia(1)
                hue-rotate(90deg)
                saturate(2.5)
                drop-shadow(0 0 3px #00ff88)
                drop-shadow(0 0 6px #00ff88)
                drop-shadow(0 0 9px #00ff88);
        }
    }
`

// Chat Components
export function ChatSidebar({ activeChannel, onChannelSelect, channels, directMessages, onLogout }) {
    return (
        <div className="chat-sidebar">
            <div className="sidebar-header">
                <h2>Cartesian Theater</h2>
                <div className="user-menu">
                    <div className="user-status online"></div>
                    <span>You</span>
                </div>
            </div>

            <ChannelSection
                title="Channels"
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

            <ChannelSection
                title="Find Friends"
                items={[{ id: 'find', name: 'Coming Soon...', disabled: true }]}
                activeId={null}
                onSelect={() => {}}
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
    return (
        <div
            className={`channel-item ${isActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={onClick}
        >
            <span className="channel-prefix">{isDM ? '' : '#'}</span>
            {isDM && item.status && <div className={`user-status ${item.status}`}></div>}
            <span className="channel-name">{item.name}</span>
            {item.unread > 0 && <span className="unread-badge">{item.unread}</span>}
        </div>
    )
}

export function ChatMain({ activeChannel, messages, onSendMessage }) {
    const [messageText, setMessageText] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        if (messageText.trim()) {
            onSendMessage(messageText)
            setMessageText('')
        }
    }

    return (
        <div className="chat-main">
            <div className="chat-header">
                <h3># {activeChannel}</h3>
                <div className="header-actions">
                    <button className="header-button">🔍</button>
                    <button className="header-button">ℹ️</button>
                </div>
            </div>

            <MessageList messages={messages} />

            <form className="message-input-container" onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="message-input"
                    placeholder={`Message #${activeChannel}`}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                />
                <button type="submit" className="send-button">Send</button>
            </form>
        </div>
    )
}

function MessageList({ messages }) {
    return (
        <div className="messages-container">
            {messages.map(msg => (
                <Message key={msg.id} message={msg} />
            ))}
        </div>
    )
}

function Message({ message }) {
    const messageClass = `message ${message.isSystem ? 'system-message' : ''} ${message.isOwn ? 'own-message' : ''}`

    return (
        <div className={messageClass}>
            {!message.isSystem && (
                <div className="message-avatar">
                    {message.user[0].toUpperCase()}
                </div>
            )}
            <div className="message-content">
                {!message.isSystem && (
                    <div className="message-header">
                        <span className="message-user">{message.user}</span>
                        <span className="message-time">{message.time}</span>
                    </div>
                )}
                <div className="message-text">{message.text}</div>
            </div>
        </div>
    )
}

export { AuthForm, MessageDisplay, BackButton }