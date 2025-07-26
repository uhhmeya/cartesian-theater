import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import { handleLogout } from '../services/auth'
import { useSocialData } from '../hooks/useSocialData'
import { UserAvatar } from '../components/UserAvatar'
import {SidebarItem} from '../components/SidebarItem.jsx'
import '../styles/dashboard/sidebar.css'
import '../styles/dashboard/messages.css'
import '../styles/dashboard/friends.css'

function Dashboard() {
    const navigate = useNavigate()

    //message = {sender, text, time, recipient}
    const [messages, setMessages] = useState([])
    const [inputText, setInputText] = useState('')
    const [myUsername] = useState(localStorage.getItem('username') || 'User')
    const messagesEndRef = useRef(null)
    const [showNonfriendList, setShowNonfriendList] = useState(false)
    const [activeFriend, setActiveFriend] = useState(null)

    const { allUsers, friends, outgoingRequests, incomingRequests,
        refresh, sendFriendRequest, acceptRequest, rejectRequest, withdrawRequest } = useSocialData()

    const { connectionStatus, sendMessage } =
        useWebSocket(data => setMessages(prev => [...prev, data]))

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}

    //called when user gets dm in channel they are currently viewing
    useEffect(() => {
        scrollToBottom()}, [messages])

    //called when user clicks +
    useEffect(() => {
            if (showNonfriendList) refresh()},
        [showNonfriendList])



    const handleSendMessage = e => {
        e.preventDefault()
        if (inputText.trim()) {
            setMessages(prev => [...prev, { user: myUsername, text: inputText, timestamp: new Date().toISOString() }])
            sendMessage(inputText)
            setInputText('')}}

    return (
        <div className="chat-container">

            {/* Logo and your Username */}
            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <h2>Cartesian Theater</h2>

                    <div className="user-menu">
                        <UserAvatar username={myUsername} className="user-profile" />
                        <span>{myUsername}</span>
                    </div>
                </div>

                {/* Friends Section */}
                <div className="channel-section">
                    <div className="section-header">
                        <span>Friends</span>
                        <button className="add-friend-btn" onClick={() => setShowNonfriendList(true)}>+</button>
                    </div>
                    <div className="channel-list">

                        {/*loops through friends list */}
                        {friends.map(friend => (
                            <SidebarItem key={friend.id} active={!showNonfriendList} onClick={() => {
                                //does nothing if nonfriendslist is not being shown
                                setShowNonfriendList(false)
                                setActiveFriend(friend)
                            }}>
                                <span className="channel-name">{friend.username}</span>
                            </SidebarItem>
                        ))}
                    </div>
                </div>

                {/* Outgoing Requests Section */}
                <div className="channel-section">
                    <div className="section-header"><span>Outgoing Requests</span></div>
                    <div className="channel-list">
                        {outgoingRequests.map(req => (
                            <SidebarItem key={req.id}>
                                <span className="channel-name">{req.username}</span>
                                <button className="request-btn reject" onClick={() => withdrawRequest(req.requestId)}>✗</button>
                            </SidebarItem>
                        ))}
                    </div>
                </div>

                {/* Incoming Requests Section */}
                <div className="channel-section">
                    <div className="section-header"><span>Incoming Requests</span></div>
                    <div className="channel-list">
                        {incomingRequests.map(req => (
                            <SidebarItem key={req.id}>
                                <span className="channel-name">{req.username}</span>
                                <div className="request-buttons">
                                    <button className="request-btn accept" onClick={() => acceptRequest(req.requestId)}>✓</button>
                                    <button className="request-btn reject" onClick={() => rejectRequest(req.requestId)}>✗</button>
                                </div>
                            </SidebarItem>
                        ))}
                    </div>
                </div>

                {/* Logout */}
                <div className="sidebar-footer">
                    <button className="logout-button" onClick={() => handleLogout(navigate)}>
                        <span>←</span> Logout
                    </button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="chat-main">

                {/* Connection Bar */}
                {connectionStatus !== 'connected' && (
                    <div className={`connection-status-bar ${
                        connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`}>
                        {connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </div>)}

                {/* Add Friends Area */}
                {showNonfriendList ? (
                    <div className="user-list-container">

                        {/*loops through all users that you aren't friends with */}
                        {allUsers.filter(nonfriend => nonfriend.relationshipStatus !== 'we_are_friends').map(nonfriend => (

                            {/*profile + name + button visual */},
                                <div key={nonfriend.id} className="user-item">
                                    <UserAvatar username={nonfriend.username} className="user-avatar" />
                                    <span className="user-name">{nonfriend.username}</span>

                                    <button
                                        onClick={() => {

                                            //  button = "accept friend"
                                            if (nonfriend.relationshipStatus === 'they_sent_me_a_request')
                                                acceptRequest(nonfriend.requestId)

                                            //  button = "add friend"
                                            else
                                                sendFriendRequest(nonfriend.id)
                                        }}

                                        // button = "pending"
                                        disabled={nonfriend.relationshipStatus === 'i_sent_them_a_request'}

                                        className={nonfriend.relationshipStatus === 'i_rejected_them' || nonfriend.relationshipStatus === 'they_rejected_me' ? 'rejected-btn' : ''}>
                                        {nonfriend.relationshipStatus === 'they_sent_me_a_request' ? 'Accept Friend' :
                                            nonfriend.relationshipStatus === 'i_sent_them_a_request' ? 'Pending' :
                                                nonfriend.relationshipStatus === 'i_rejected_them' || nonfriend.relationshipStatus === 'they_rejected_me' ? 'Rejected' : 'Add Friend'}
                                    </button>
                                </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Displays all chat messages */}
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

                        {/* Textbox */}
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