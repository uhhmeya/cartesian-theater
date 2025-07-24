import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { connectWebSocket } from '../services/websocket'
import { handleLogout } from '../services/auth'
import { apiRequest } from '../services/api'
import './styles/sidebar.css'
import './styles/messages.css'
import './styles/friends.css'

function Dashboard() {
    const navigate = useNavigate()

    //message = {user, text, time}
    const [messages, setMessages] = useState([])
    const [inputText, setInputText] = useState('')
    const [myUsername] = useState(localStorage.getItem('username') || 'User')
    const [connectionStatus, setConnectionStatus] = useState('connecting')
    const socketRef = useRef(null)
    const messagesEndRef = useRef(null)
    const [outgoingRequests, setOutgoingRequests] = useState([])
    const [incomingRequests, setIncomingRequests] = useState([])

    const [showUserList, setShowUserList] = useState(false)
    const [allUsers, setAllUsers] = useState([])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}

    const fetchUsers = async () => {
        const response = await apiRequest('/api/users', null, 'GET')
        if (response.success) setAllUsers(response.data.users)}

    const fetchOutgoingRequests = async () => {
        const response = await apiRequest('/api/friend-requests/outgoing', null, 'GET')
        if (response.success) setOutgoingRequests(response.data)
    }

    const fetchIncomingRequests = async () => {
        const response = await apiRequest('/api/friend-requests/incoming', null, 'GET')
        if (response.success) setIncomingRequests(response.data)
    }

    const updateFriendRequestStatus = (userId, newStatus) => {
        setAllUsers(prev => prev.map(u => u.id === userId ? {...u, status: newStatus} : u))}

    const sendFriendRequest = async (userId) => {
        const response = await apiRequest('/api/friend-request', { receiver_id: userId })
        if (response.success) {updateFriendRequestStatus(userId, 'pending')}}

    const acceptRequest = (requestId) => {
        console.log('Accepting request:', requestId)
    }

    const rejectRequest = (requestId) => {
        console.log('Rejecting request:', requestId)
    }

    useEffect(() => {
        scrollToBottom()}, [messages])

    useEffect(() => {
        fetchOutgoingRequests()
        fetchIncomingRequests()
    }, [])

    //calls fetchUsers() when showUserList is set to true
    useEffect(() => {
            if (showUserList) fetchUsers()},
        [showUserList])

    useEffect(() => {
        const access_token = localStorage.getItem('access_token')

        //inline code called when websocket connects
        const socket = connectWebSocket(access_token, (status, socketInstance) => {
            setConnectionStatus(status)

            if (status === 'connected' && socketInstance) {
                socketRef.current = socketInstance

                //adds message that server sends to user from websocket to messages array
                socketInstance.on('message', data => {
                    setMessages(prev => [...prev, data])})

                socketInstance.on('connection_response', data => {
                    console.log('Connected:', data)})
            }
        })

        return () => socket?.disconnect()
    }, [])

    const handleSendMessage = e => {
        e.preventDefault()

        if (inputText.trim() && socketRef.current) {
            //adds message that server sends to user from websocket to messages array
            setMessages(prev => [...prev, { user: myUsername, text: inputText, timestamp: new Date().toISOString() }])

            socketRef.current.emit('message', { text: inputText })
            setInputText('')
        }
    }

    return (
        <div className="chat-container">

            {/* Sidebar */}
            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <h2>Cartesian Theater</h2>

                    <div className="user-menu">
                        <div className="user-profile">{myUsername[0].toUpperCase()}</div>
                        <span>{myUsername}</span>
                    </div>
                </div>

                <div className="channel-section">
                    <div className="section-header">
                        <span>Friends</span>
                        <button className="add-friend-btn" onClick={() => setShowUserList(true)}>+</button>
                    </div>

                    <div className="channel-list">
                        <div className={`channel-item ${!showUserList ? 'active' : ''}`} onClick={() => setShowUserList(false)}>

                            <span className="channel-name">erik</span>
                        </div>
                    </div>
                </div>

                <div className="channel-section">
                    <div className="section-header"><span>Outgoing Requests</span></div>
                    <div className="channel-list">
                        {outgoingRequests.map(req => (
                            <div key={req.id} className="channel-item">

                                <span className="channel-name">{req.username}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="channel-section">
                    <div className="section-header"><span>Incoming Requests</span></div>
                    <div className="channel-list">
                        {incomingRequests.map(req => (
                            <div key={req.id} className="channel-item">
                                <span className="channel-name">{req.username}</span>
                                <div className="request-buttons">
                                    <button className="request-btn accept" onClick={() => acceptRequest(req.id)}>✓</button>
                                    <button className="request-btn reject" onClick={() => rejectRequest(req.id)}>✗</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebar-footer">
                    <button className="logout-button" onClick={() => handleLogout(navigate)}>
                        <span>←</span> Logout
                    </button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="chat-main">

                {connectionStatus !== 'connected' && (
                    <div className={`connection-status-bar ${
                        connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                        {connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </div>
                )}

                {showUserList ? (
                    <div className="user-list-container">
                        {allUsers.map(user => (
                            <div key={user.id} className="user-item">
                                <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                                <span className="user-name">{user.username}</span>
                                <button
                                    onClick={() => sendFriendRequest(user.id)}
                                    disabled={user.status !== 'none'}
                                    className={user.status === 'rejected' ? 'rejected-btn' : ''}>
                                    {user.status === 'pending' ? 'Pending' : user.status === 'rejected' ? 'Rejected' : 'Add Friend'}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="messages-container">
                            {messages.map((msg, i) => (
                                <div
                                    key={i}
                                    className={`chat-message ${msg.user === myUsername ? 'own-message' : ''}`}
                                >
                                    <div className="message-wrapper">
                                        <div className="message-bubble">
                                            <div className="message-text">{msg.text}</div>
                                        </div>

                                        {msg.user !== myUsername && (
                                            <div className="message-sender">{msg.user}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <form className="message-input-container" onSubmit={handleSendMessage}>
                            <div
                                className="message-input"
                                contentEditable
                                placeholder="Message erik"
                                onInput={e => setInputText(e.target.textContent)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSendMessage(e)
                                        e.target.textContent = ''
                                    }
                                }}
                            />

                            <button
                                type="submit"
                                className="send-button"
                                disabled={connectionStatus !== 'connected' || !inputText.trim()}
                            >
                                Send
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}

export default Dashboard