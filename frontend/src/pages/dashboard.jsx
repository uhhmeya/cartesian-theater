import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Stars } from '../components/Stars.jsx'
import { connectWebSocket, handleLogout } from '../utility.jsx'
import './styles/dashboard.css'

function Dashboard() {

    const navigate = useNavigate()
    const [messages, setMessages] = useState([])
    const [messageText, setMessageText] = useState('')
    const [username] = useState(localStorage.getItem('username') || 'User')
    const [connectionStatus, setConnectionStatus] = useState('connecting')
    const socketRef = useRef(null)

    useEffect(() => {
        const socket = connectWebSocket((status, socketInstance) => {
            setConnectionStatus(status)
            if (status === 'connected' && socketInstance) {
                socketRef.current = socketInstance
                socketInstance.on('message', data => setMessages(prev => [...prev, data]))
                socketInstance.on('connection_response', data => {
                    setMessages([{ user: 'erik_ai', text: 'Hello! How can I help you today?', timestamp: new Date().toISOString() }])
                })
            }
        })
        return () => socket?.disconnect()
    }, [])

    const handleSubmit = e => {
        e.preventDefault()
        if (messageText.trim() && socketRef.current) {
            setMessages(prev => [...prev, { user: username, text: messageText, timestamp: new Date().toISOString() }])
            socketRef.current.emit('message', { text: messageText })
            setMessageText('')
        }
    }

    return (
        <div className="chat-container">
            <Stars />

            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <h2><div className="logo-circle"><span>CT</span></div>Cartesian Theater</h2>
                    <div className="user-menu">
                        <div className="user-profile">{username[0].toUpperCase()}<div className="user-status online"></div></div>
                        <span>{username}</span>
                    </div>
                </div>

                <div className="channel-section">
                    <div className="section-header"><span>Direct Messages</span></div>
                    <div className="channel-list">
                        <div className="channel-item active">
                            <div className="dm-avatar">E<div className="user-status online"></div></div>
                            <span className="channel-name">erik_ai</span>
                        </div>
                    </div>
                </div>

                <div className="sidebar-footer">
                    <button className="logout-button" onClick={() => handleLogout(navigate)}><span>←</span> Logout</button>
                </div>
            </div>

            <div className="chat-main">
                {connectionStatus !== 'connected' && (
                    <div className={`connection-status-bar ${connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`}>
                        {connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </div>
                )}

                <div className="messages-container">
                    {messages.map((msg, i) => (
                        <div key={i} className={`chat-message ${msg.user === username ? 'own-message' : ''}`}>
                            {msg.user !== username && <div className="message-avatar">{msg.user[0].toUpperCase()}</div>}
                            <div className="message-wrapper">
                                <div className="message-bubble"><div className="message-text">{msg.text}</div></div>
                                {msg.user !== username && <div className="message-sender">{msg.user}</div>}
                            </div>
                        </div>
                    ))}
                </div>

                <form className="message-input-container" onSubmit={handleSubmit}>
                    <input type="text" className="message-input" placeholder="Message erik_ai" value={messageText}
                           onChange={e => setMessageText(e.target.value)} disabled={connectionStatus !== 'connected'} />
                    <button type="submit" className="send-button" disabled={connectionStatus !== 'connected' || !messageText.trim()}>Send</button>
                </form>
            </div>
        </div>
    )
}

export default Dashboard