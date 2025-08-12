import { useState, useEffect, useRef } from 'react'
import { apiRequest} from "../services/api.js";
import { useNavigate } from 'react-router-dom'
import { useWebSocket } from '../hooks/useWebSocket'
import { useSocialData } from '../hooks/useSocialData'
import { UserAvatar } from '../components/UserAvatar'
import {SidebarItem} from '../components/SidebarItem.jsx'
import { Message } from '../components/Message.jsx'
import { useConversation } from '../hooks/useConversation'
import { useSharedSecrets } from '../hooks/useSharedSecrets'
import { loadConversationHistory, shouldScrollToBottom, encrypt, decrypt,
    decryptConversationHistory } from '../services/crypto.js'

import '../styles/dashboard/sidebar.css'
import '../styles/dashboard/messages.css'
import '../styles/dashboard/friends.css'
import {useLocation} from "react-router-dom";

const handleLogout = (navigate) => {
    localStorage.clear()
    navigate('/')
}

// message = {sender, text, time, receiver}
// messages is an array that stores message objects

function Dashboard() {
    const navigate = useNavigate()
    const location = useLocation()

    const [messages, setMessages] = useState([])
    const [inputText, setInputText] = useState('')
    const [myUsername] = useState(localStorage.getItem('username') || 'User')
    const messagesEndRef = useRef(null)
    const [showNonfriendList, setShowNonfriendList] = useState(false)
    const [activeFriend, setActiveFriend] = useState(null)
    const [loadedChats, setLoadedChats] = useState(new Set())

    const keys = location.state?.privateKeys
    const [privateIdentityKey] = useState(keys?.identity)
    const [privateWeeklyKey] = useState(keys?.weekly)
    const [privateSingleUseKeys] = useState(keys?.singleUse)

    const conversation = useConversation(messages, myUsername, activeFriend)

    const { allUsers, friends, outgoingRequests, incomingRequests,
        refresh, sendFriendRequest, acceptRequest, rejectRequest, withdrawRequest } = useSocialData()

    const { sharedSecrets, deriveAllSharedSecrets } = useSharedSecrets(friends, privateIdentityKey)

    const handleIncomingMessage = (data) => {
        const secret = sharedSecrets[data.sender]
        if (secret && data.sender !== 'erik')
            data.text = decrypt(data.text, secret)
        setMessages(prev => [...prev, data])
    }

    const handleStatusUpdate = (data) => {
        setMessages(prev => prev.map(msg =>
            msg.id === data.messageId ? {...msg, status: data.status} : msg))
    }

    const { connectionStatus, sendMessage, socket } = useWebSocket(handleIncomingMessage, handleStatusUpdate)

    // auto refresh
    useEffect(() => {
        if (socket) {
            socket.on('social_update', async () => {
                await refresh()
            })
            return () => socket.off('social_update')
        }
    }, [socket, refresh])

    // auto scroll
    useEffect(() => {
        const lastMessage = messages[messages.length - 1]
        if (shouldScrollToBottom(lastMessage, myUsername, activeFriend))
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, activeFriend, myUsername])

    // user clicks + ⟶ social data refresh
    useEffect(() => {
        if (showNonfriendList) refresh()}, [showNonfriendList])

    // friends array populate ⟶ all shared secrets derived + erik set as active friend
    // new friend ⟶ all shared secrets derived
    useEffect(() => {
        const isFirstPopulation = !activeFriend
        deriveAllSharedSecrets().then(() => {
            if (isFirstPopulation) {
                const erik = friends.find(f => f.username === 'erik')
                if (erik) setActiveFriend(erik)
            }
        })
    }, [friends.length])

    // new active friend --> loads convo history
    useEffect(() => {
        if (!activeFriend || loadedChats.has(activeFriend.username)
            || activeFriend.username === 'erik' || !sharedSecrets[activeFriend.username]) return

        loadConversationHistory(activeFriend.username).then(history => {
            if (history.length) {
                const decryptedHistory = decryptConversationHistory(history, sharedSecrets, activeFriend)
                setMessages(prev => [...decryptedHistory, ...prev])
                setLoadedChats(prev => new Set(prev).add(activeFriend.username))
            }
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
        })
    }, [activeFriend, sharedSecrets])

    const handleSendMessage = e => {
        e.preventDefault()
        if (inputText.trim() && activeFriend) {
            const messageId = `${Date.now()}-${Math.random()}`

            const secret = sharedSecrets[activeFriend.username]
            const encryptedText = secret ? encrypt(inputText, secret) : inputText
            sendMessage(encryptedText, activeFriend.username, messageId)

            setMessages(prev => [...prev, {
                id: messageId,
                sender: myUsername,
                text: inputText,
                time: new Date().toISOString(),
                receiver: activeFriend.username,
                status: 'sending'
            }])
            setInputText('')
        }
    }

    const getNonfriendButton = (status) => {
        const configs = {
            'they_sent_me_a_request': { text: 'Accept Friend', className: '' },
            'i_sent_them_a_request': { text: 'Pending', className: '' },
            'i_rejected_them': { text: 'Rejected', className: 'rejected-btn' },
            'they_rejected_me': { text: 'Rejected', className: 'rejected-btn' }}
        return configs[status] || { text: 'Add Friend', className: '' }
    }

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
                            // shows red highlight if friend's convo is being viewed
                            <SidebarItem key={friend.id} active={friend.id === activeFriend?.id && !showNonfriendList} onClick={() => {
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

                        {/*loops through all nonfriends */}
                        {allUsers.filter(nonfriend => nonfriend.relationshipStatus !== 'we_are_friends').map(nonfriend => (
                            <div key={nonfriend.id} className="user-item">
                                <UserAvatar username={nonfriend.username} className="user-avatar" />
                                <span className="user-name">{nonfriend.username}</span>
                                <button
                                    onClick={() => {
                                        if (nonfriend.relationshipStatus === 'they_sent_me_a_request') // accept friend
                                            acceptRequest(nonfriend.requestId)
                                        else // add friend
                                            sendFriendRequest(nonfriend.id) }}

                                    disabled={nonfriend.relationshipStatus === 'i_sent_them_a_request'} // pending

                                    // displays nonfriend button
                                    className={getNonfriendButton(nonfriend.relationshipStatus).className}>
                                    {getNonfriendButton(nonfriend.relationshipStatus).text}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Displays conservations */}
                        <div className="messages-container">
                            {conversation.map((msg, i) => (
                                <Message
                                    key={i}
                                    message={msg}
                                    myUsername={myUsername}
                                    isLatest={i === conversation.length - 1 && msg.sender === myUsername}
                                />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Textbox */}
                        <form className="message-input-container" onSubmit={handleSendMessage}>
                            <div
                                className="message-input"
                                contentEditable={!!activeFriend}
                                placeholder={activeFriend ? `Message ${activeFriend.username}` : ""}
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