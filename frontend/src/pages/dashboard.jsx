import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import { handleLogout } from '../services/auth'
import { useSocialData } from '../hooks/useSocialData'
import { UserAvatar } from '../components/UserAvatar'
import { ChannelItem } from '../components/ChannelItem.jsx'
import '../styles/dashboard/sidebar.css'
import '../styles/dashboard/messages.css'
import '../styles/dashboard/friends.css'

function Dashboard() {
    const navigate = useNavigate()

    //message = {user, text, time}
    const [messages, setMessages] = useState([])
    const [inputText, setInputText] = useState('')
    const [myUsername] = useState(localStorage.getItem('username') || 'User')
    const messagesEndRef = useRef(null)
    const [showUserList, setShowUserList] = useState(false)

    const { allUsers, friends, outgoingRequests, incomingRequests,
        refresh, sendFriendRequest, acceptRequest, rejectRequest, cancelRequest } =
        useSocialData()

    const { connectionStatus,
        sendMessage } =
        useWebSocket(data => setMessages(prev => [...prev, data]))

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}

    //called when user gets dm in channel they are currently viewing
    useEffect(() => {
        scrollToBottom()}, [messages])

    //called when user clicks +
    useEffect(() => {
            if (showUserList) refresh()},
        [showUserList])

    const handleSendMessage = e => {
        e.preventDefault()
        if (inputText.trim()) {
            setMessages(prev => [...prev, { user: myUsername, text: inputText, timestamp: new Date().toISOString() }])
            sendMessage(inputText)
            setInputText('')}}

    return (
        <div className="chat-container">

            {/* Sidebar */}
            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <h2>Cartesian Theater</h2>

                    <div className="user-menu">
                        <UserAvatar username={myUsername} className="user-profile" />
                        <span>{myUsername}</span>
                    </div>
                </div>

                <div className="channel-section">
                    <div className="section-header">
                        <span>Friends</span>
                        <button className="add-friend-btn" onClick={() => setShowUserList(true)}>+</button>
                    </div>

                    <div className="channel-list">
                        {friends.map(friend => (
                            <ChannelItem key={friend.id} active={!showUserList} onClick={() => setShowUserList(false)}>
                                <span className="channel-name">{friend.username}</span>
                            </ChannelItem>
                        ))}
                    </div>
                </div>

                <div className="channel-section">
                    <div className="section-header"><span>Outgoing Requests</span></div>
                    <div className="channel-list">
                        {outgoingRequests.map(req => (
                            <ChannelItem key={req.id}>
                                <span className="channel-name">{req.username}</span>
                                <button className="request-btn reject" onClick={() => cancelRequest(req.requestId)}>✗</button>
                            </ChannelItem>
                        ))}
                    </div>
                </div>

                <div className="channel-section">
                    <div className="section-header"><span>Incoming Requests</span></div>
                    <div className="channel-list">
                        {incomingRequests.map(req => (
                            <ChannelItem key={req.id}>
                                <span className="channel-name">{req.username}</span>
                                <div className="request-buttons">
                                    <button className="request-btn accept" onClick={() => acceptRequest(req.requestId)}>✓</button>
                                    <button className="request-btn reject" onClick={() => rejectRequest(req.requestId)}>✗</button>
                                </div>
                            </ChannelItem>
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
                                <UserAvatar username={user.username} className="user-avatar" />
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
                                        e.target.textContent = ''}}}
                            />
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}

export default Dashboard