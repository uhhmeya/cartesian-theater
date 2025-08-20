import {useEffect, useRef, useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {useWebSocket} from '../hooks/useWebSocket'
import {useSocialData} from '../hooks/useSocialData'
import {UserAvatar} from '../components/UserAvatar'
import {SidebarItem} from '../components/SidebarItem.jsx'
import {Message} from '../components/Message.jsx'
import {apiRequest} from '../services/api'
import { generateKeyPair, getSharedSecret, encrypt, decrypt } from '../services/crypto/keys.js'
import { kdfRoot } from '../services/crypto/ratchet.js'
import '../styles/dashboard/sidebar.css'
import '../styles/dashboard/messages.css'
import '../styles/dashboard/friends.css'

const handleLogout = (navigate) => {
    localStorage.clear()
    navigate('/')
}

const loadHistory = async (username, sharedSecret) => {
    const response = await apiRequest(`/conversation/${username}`, null, 'GET')
    if (!response.success || !response.data.messages.length) return []

    return await Promise.all(
        response.data.messages.map(async msg => ({
            ...msg,
            text: await decrypt(msg.text, sharedSecret)
        })))
}

function Dashboard() {
    const navigate = useNavigate()
    const location = useLocation()

    const messagesEndRef = useRef(null) // auto scroll

    const [messages, setMessages] = useState([]) // array of message objects
    const [inputText, setInputText] = useState('')
    const [myUsername] = useState(localStorage.getItem('username') || 'User')
    const [showNonfriendList, setShowNonfriendList] = useState(false)
    const [activeFriend, setActiveFriend] = useState(null)
    const [loadedUsers, setLoadedUsers] = useState(new Set()) //array of usernames for which chats have been loaded

    const privateKey = location.state?.privateKey
    const [sharedSecrets, setSharedSecrets] = useState({})
    const [initialDH, setInitialDH] = useState({})
    const [rootKeys, setRootKeys] = useState({})
    const [sendingChainKeys, setSendingChainKeys] = useState({})
    const [receivingChainKeys, setReceivingChainKeys] = useState({})
    const [pubIdentityKeys, setPubIdentityKeys] = useState({})

    const conversation = !activeFriend ? [] : messages.filter(msg =>
        (msg.sender === myUsername && msg.receiver === activeFriend.username) ||
        (msg.sender === activeFriend.username && msg.receiver === myUsername))

    const { allUsers, friends, outgoingRequests, incomingRequests,
        refresh, sendFriendRequest, acceptRequest, rejectRequest, withdrawRequest } = useSocialData()

    const handleIncomingMessage = async (data) => {
        if (data.sender === 'erik') {
            setMessages(prev => [...prev, data])
            return}
        const decryptedText = await decrypt(data.text, sharedSecrets[data.sender])
        setMessages(prev => [...prev, {...data, text: decryptedText}])
    }

    const handleStatusUpdate = (data) => {
        setMessages(prev => prev.map(msg => msg.id === data.messageId ? {...msg, status: data.status} : msg))
    }

    const { connectionStatus, sendMessage, socket } = useWebSocket(handleIncomingMessage, handleStatusUpdate, refresh)

    // auto scroll
    useEffect(() => {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage && activeFriend &&
            ((lastMessage.sender === myUsername && lastMessage.receiver === activeFriend.username) ||
                (lastMessage.sender === activeFriend.username && lastMessage.receiver === myUsername)))
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, activeFriend, myUsername])

    // user clicks + :
    useEffect(() => {
        if (!showNonfriendList) return
        refresh()
    }, [showNonfriendList])

    // new active friend :
    useEffect(() => {
        if (!activeFriend) {
            console.log('Early Return : new active friend useEffect prevented from running on mount')
            return}

        if (loadedUsers.has(activeFriend.username)) {
            console.log('Early Return : new active friend useEffect prevented from getting same history twice for ', activeFriend.username)
            return}

        if (activeFriend.username === 'erik') {
            console.log('Early Return : new active friend useEffect prevented getting history for erik')
            return}

        loadHistory(activeFriend.username, sharedSecrets[activeFriend.username]).then(async history => {

            if (history.length > 0) {
                console.log(`Early Return : initialDH already exists; fetched nonzero history for : ${activeFriend.username}`)
                setMessages(prev => [...prev, ...history])
                setLoadedUsers(prev => new Set([...prev, activeFriend.username]))
                return
            }

            const savedDH = localStorage.getItem(`initialDH_${activeFriend.username}`)
            if (savedDH) {
                console.log(`Early Return : Fetched saved initialDH in storage for : ${activeFriend.username}`)
                setInitialDH(prev => ({...prev, [activeFriend.username]: savedDH}))
                setLoadedUsers(prev => new Set([...prev, activeFriend.username]))
                return
            }

            const response = await apiRequest('/get-root-role', {friendUsername: activeFriend.username})

            if (response.data.data.role === 'initiator') {

                const [erinEphPriv, erinEphPub] = generateKeyPair()
                console.log(`Ephemeral keys for ${activeFriend.username} - Private: ${erinEphPriv.slice(0, 16)}..., Public: ${erinEphPub.slice(0, 16)}...`)

                const newDH = getSharedSecret(erinEphPriv, pubIdentityKeys[activeFriend.username])
                console.log(`Initial DH derived (initiator) for ${activeFriend.username}:`, newDH.slice(0, 16) + '...')
                setInitialDH(prev => ({...prev, [activeFriend.username]: newDH}))
                localStorage.setItem(`initialDH_${activeFriend.username}`, newDH)

                await apiRequest('/initiate-rootkey', {friendUsername: activeFriend.username, ephemeralPublic: erinEphPub})

            } else {
                const ameyaEphPub = response.data.data.ephemeralPublic
                console.log(`Public Ephemeral key retrieved for ${activeFriend.username}:`, ameyaEphPub.slice(0, 16) + '...')

                const newDH = getSharedSecret(privateKey, ameyaEphPub)
                console.log(`✓ Initial DH derived (responder) for ${activeFriend.username}:`, newDH.slice(0, 16) + '...')
                setInitialDH(prev => ({...prev, [activeFriend.username]: newDH}))
                localStorage.setItem(`initialDH_${activeFriend.username}`, newDH)
            }

            setMessages(prev => [...prev, ...history])
            setLoadedUsers(prev => new Set([...prev, activeFriend.username]))
        })
    }, [activeFriend])

    useEffect(() => {
        if (!activeFriend && connectionStatus === 'connected') {
            setActiveFriend({ username: 'erik', id: 'erik' })
        }
    }, [activeFriend, connectionStatus])

    // get all shared secrets
    useEffect(() => {
        if (!friends.length || connectionStatus !== 'connected') return

        friends.forEach(async friend => {
            if (friend.username === 'erik' || sharedSecrets[friend.username]) return

            const response = await apiRequest(`/get-identity-key/${friend.username}`, null, 'GET')
            if (!response.success) return

            const ameyaIdentityKey = response.data.data.identityPublic
            console.log(`Public Identity key retrieved for ${friend.username}:`, ameyaIdentityKey?.slice(0, 16) + '...')
            setPubIdentityKeys(prev => ({...prev, [friend.username]: ameyaIdentityKey}))

            const secret = getSharedSecret(privateKey, ameyaIdentityKey)
            console.log(`✓ Shared secret derived for ${friend.username}:`, secret.slice(0, 16) + '...')
            setSharedSecrets(prev => ({...prev, [friend.username]: secret}))
        })
    }, [friends, connectionStatus])

    const handleSendMessage = async e => {
        e.preventDefault()
        if (!inputText.trim() || !activeFriend) return
        const messageId = `${Date.now()}-${Math.random()}`

        const messageText = activeFriend.username === 'erik' ?
            inputText : await encrypt(inputText, sharedSecrets[activeFriend.username])

        sendMessage(messageText, activeFriend.username, messageId)

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
                                <button className="request-btn reject" onClick={() => withdrawRequest(req.requestId)}>×</button>
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
                                    <button className="request-btn reject" onClick={() => rejectRequest(req.requestId)}>×</button>
                                </div>
                            </SidebarItem>
                        ))}
                    </div>
                </div>

                {/* Logout */}
                <div className="sidebar-footer">
                    <button className="logout-button" onClick={() => handleLogout(navigate)}>
                        <span>← </span> Logout
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