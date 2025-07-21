import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Stars } from '../components/Stars.jsx'
import { connectWebSocket } from '../services/websocket'
import { handleLogout } from '../services/auth'
import './styles/dashboard.css'

function Dashboard() {

    const navigate = useNavigate()

    //message = {user, text, time}
    //messages = array of all messages
    const [messages, setMessages] = useState([])

    //inputText = text currently being typed in input field
    const [inputText, setInputText] = useState('')

    //username of the current user that is logged in
    const [myUsername] = useState(localStorage.getItem('username') || 'User')

    const [connectionStatus, setConnectionStatus] = useState('connecting')
    const socketRef = useRef(null)



    useEffect(() => {

        const access_token = localStorage.getItem('access_token')

        //connectWebSocket(inline-function)
        //connectWebSocket() sends websocket connection request to backend
        //The inline code is called when backend sends response
        const socket = connectWebSocket(access_token, (status, socketInstance) => {

            setConnectionStatus(status)
            if (status === 'connected' && socketInstance) {
                socketRef.current = socketInstance

                //when backend sends message from websocket, the message is stored in messages
                socketInstance.on('message', data => setMessages(prev => [...prev, data]))
                //when websocket successfully connects, erik says hi
                socketInstance.on('connection_response', data => {setMessages([{ user: 'erik_ai', text: 'Hi?', timestamp: new Date().toISOString() }])})
            }
        })
        //websocket is closed when dashboard dismounts
        return () => socket?.disconnect()
    }, [])

    const handleSendMessage = e => {
        e.preventDefault()
        if (inputText.trim() && socketRef.current) {
            //adds outgoing messages to messages array
            setMessages(prev => [...prev, { user: myUsername, text: inputText, timestamp: new Date().toISOString() }])
            //sends messages to backend
            socketRef.current.emit('message', { text: inputText })
            setInputText('')
        }
    }

    //sends message to backend --> backend responds --> backend's response added to messages array --> messages are displayed

    return (
        <div className="chat-container">
            <Stars />

            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <h2><div className="logo-circle"><span>CT</span></div>Cartesian Theater</h2>
                    <div className="user-menu">
                        <div className="user-profile">{myUsername[0].toUpperCase()}<div className="user-status online"></div></div>
                        <span>{myUsername}</span>
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
                        <div key={i} className={`chat-message ${msg.user === myUsername ? 'own-message' : ''}`}>
                            {msg.user !== myUsername && <div className="message-avatar">{msg.user[0].toUpperCase()}</div>}
                            <div className="message-wrapper">
                                <div className="message-bubble"><div className="message-text">{msg.text}</div></div>
                                {msg.user !== myUsername && <div className="message-sender">{msg.user}</div>}
                            </div>
                        </div>
                    ))}
                </div>

                <form className="message-input-container" onSubmit={handleSendMessage}>
                    <input type="text" className="message-input" placeholder="Message erik_ai" value={inputText}
                           onChange={e => setInputText(e.target.value)} disabled={connectionStatus !== 'connected'} />
                    <button type="submit" className="send-button" disabled={connectionStatus !== 'connected' || !inputText.trim()}>Send</button>
                </form>
            </div>
        </div>
    )
}

export default Dashboard