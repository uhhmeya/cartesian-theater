import {useEffect, useRef, useState, useMemo} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {useWebSocket} from '../hooks/useWebSocket'
import {useSocialData} from '../hooks/useSocialData'
import {UserAvatar} from '../components/UserAvatar'
import {SidebarItem} from '../components/SidebarItem.jsx'
import {Message} from '../components/Message.jsx'
import {apiRequest} from '../services/api'
import {encrypt, decrypt} from '../services/crypto/keys.js'
import {getAllSharedSecrets, initiatorEphExchange, receiverEphExchange, initRatchetAlice, initRatchetBob, performReceivingDHRatchet, performReceivingChainRatchet, performSendingChainRatchet } from '../services/crypto/ratchet.js'
import '../styles/dashboard/sidebar.css'
import '../styles/dashboard/messages.css'
import '../styles/dashboard/friends.css'

const handleLogout = (navigate) => {
    localStorage.removeItem('username')
    localStorage.removeItem('token')
    navigate('/')
}

function Dashboard() {

    const handleIncomingMessage = async (data) => {
        if (data.sender === 'erik') {
            setMessages(prev => [...prev, data])
            return
        }

        const payload = JSON.parse(data.text)
        const { header, payload: encryptedText } = payload
        let state = states[data.sender]

        if (!state) {

            const myMatchingPrekeyPrivate = localStorage.getItem(`prekey_${header.prekeyIndex}`)

            let SK = SKs[data.sender]

            if (!SK) {
                console.log(`Computing SK for incoming message from ${data.sender}`)

                const response = await apiRequest('/get-root-role', {friendUsername: data.sender})
                const initiator_EphPub = response.data.data.ephemeralPublic

                console.log(`Retrieved ephemeral public key for ${data.sender}:`, initiator_EphPub.slice(0, 16) + '...')

                SK = await receiverEphExchange(
                    data.sender,
                    identitySecrets[data.sender],
                    myIdentityPrivKey,
                    initiator_EphPub)

                setSKs(prev => ({...prev, [data.sender]: SK}))
                localStorage.setItem(`SK_${data.sender}`, SK)
            }

            state = await initRatchetBob(data.sender, SK, myMatchingPrekeyPrivate, header.ratchetPubKey)
        } else {
            if (header.ratchetPubKey !== state.other_RatchetPubKey) {
                await performReceivingDHRatchet(state, header.ratchetPubKey, data.sender)
            }
        }

        // Chain ratchet
        const messageKey = await performReceivingChainRatchet(state)

        console.log(`[receiving chain key ${data.sender}] New Chain Key: ${state.recieving_ChainKey.slice(0, 16)}...`)
        console.log(`[receiving chain key's decryption ${data.sender}] Message Key: ${messageKey.slice(0, 16)}...`)

        const decryptedText = await decrypt(encryptedText, messageKey)

        setStates(prev => ({...prev, [data.sender]: state}))
        localStorage.setItem(`ratchet_state_${data.sender}`, JSON.stringify(state))
        setMessages(prev => [...prev, {...data, text: decryptedText}])
    }

    const handleStatusUpdate = (data) => {
        setMessages(prev => prev.map(msg => msg.id === data.messageId ? {...msg, status: data.status} : msg))
    }

    const navigate = useNavigate()
    const location = useLocation()

    const messagesEndRef = useRef(null)

    const [messages, setMessages] = useState([])
    const [inputText, setInputText] = useState('')
    const [myUsername] = useState(localStorage.getItem('username') || 'User')
    const [showNonfriendList, setShowNonfriendList] = useState(false)
    const [activeFriend, setActiveFriend] = useState(null)
    const [loadedUsers, setLoadedUsers] = useState(new Set())

    const { allUsers, friends, outgoingRequests, incomingRequests,
        refresh, sendFriendRequest, acceptRequest, rejectRequest, withdrawRequest } = useSocialData()

    const conversation = useMemo(() => {
        if (!activeFriend) return []
        return messages.filter(msg =>
            (msg.sender === myUsername && msg.receiver === activeFriend.username) ||
            (msg.sender === activeFriend.username && msg.receiver === myUsername))
    }, [activeFriend, messages, myUsername])

    const {connectionStatus, sendMessage, socket } = useWebSocket(handleIncomingMessage, handleStatusUpdate, refresh)
    const [states, setStates] = useState({})

    const myIdentityPrivKey = location.state?.privateKey

    const [identitySecrets, setIdentitySecrets] = useState({})
    const [pubIdentityKeys, setPubIdentityKeys] = useState({})
    const [SKs, setSKs] = useState({})

    // get all shared secrets on mount
    useEffect(() => {
        if (!friends.length || connectionStatus !== 'connected') return

        const missingSecrets = friends.filter(f => f.username !== 'erik' && !identitySecrets[f.username])
        if (missingSecrets.length === 0) return

        getAllSharedSecrets(myIdentityPrivKey, friends, connectionStatus).then(({ identitySecrets, pubIdentityKeys }) => {
            setIdentitySecrets(prev => ({ ...prev, ...identitySecrets }))
            setPubIdentityKeys(prev => ({ ...prev, ...pubIdentityKeys }))})
    }, [friends, connectionStatus])

    // Load states on mount
    useEffect(() => {
        const loadedStates = {}
        friends.forEach(friend => {
            const saved = localStorage.getItem(`ratchet_state_${friend.username}`)
            if (saved) {
                loadedStates[friend.username] = JSON.parse(saved)
            }
        })
        if (Object.keys(loadedStates).length > 0)
            setStates(prev => ({...prev, ...loadedStates}))

    }, [friends])

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
    }, [showNonfriendList, refresh])

    // new active friend :
    useEffect(() => {
        if (!activeFriend) {
            console.log('Early Return : new active friend useEffect prevented from running on mount')
            return
        }

        if (loadedUsers.has(activeFriend.username)) {
            console.log('Early Return : new active friend useEffect prevented from getting same SK twice for ', activeFriend.username)
            return
        }

        if (activeFriend.username === 'erik') {
            console.log('Early Return : new active friend useEffect prevented getting SK for erik')
            return
        }

        const savedSK = localStorage.getItem(`SK_${activeFriend.username}`)

        if (savedSK) {
            console.log('Early Return : Saved SK in local storage')
            setSKs(prev => ({...prev, [activeFriend.username]: savedSK}))
            setLoadedUsers(prev => new Set([...prev, activeFriend.username]))
            return
        }

        // No SK exists, do ephExchange
        apiRequest('/get-root-role', {friendUsername: activeFriend.username})
            .then(async response => {
                let SK

                if (response.data.data.role === 'initiator') {
                    SK = await initiatorEphExchange(
                        activeFriend.username,
                        identitySecrets[activeFriend.username],
                        pubIdentityKeys[activeFriend.username]
                    )
                } else {
                    const initiator_EphPub = response.data.data.ephemeralPublic
                    SK = await receiverEphExchange(
                        activeFriend.username,
                        identitySecrets[activeFriend.username],
                        myIdentityPrivKey,
                        initiator_EphPub
                    )
                }

                setSKs(prev => ({...prev, [activeFriend.username]: SK}))
                localStorage.setItem(`SK_${activeFriend.username}`, SK)
                setLoadedUsers(prev => new Set([...prev, activeFriend.username]))
            })

    }, [activeFriend, identitySecrets, pubIdentityKeys, myIdentityPrivKey])

    useEffect(() => {
        if (!activeFriend && connectionStatus === 'connected') {
            setActiveFriend({ username: 'erik', id: 'erik' })
        }
    }, [activeFriend, connectionStatus])

    const handleSendMessage = async e => {
        e.preventDefault()
        if (!inputText.trim() || !activeFriend) return
        const messageId = `${Date.now()}-${Math.random()}`

        if (activeFriend.username === 'erik') {
            sendMessage(inputText, activeFriend.username, messageId)
            setMessages(prev => [...prev, {
                id: messageId,
                sender: myUsername,
                text: inputText,
                time: new Date().toISOString(),
                receiver: activeFriend.username,
                status: 'sending'
            }])
            setInputText('')
            return
        }

        let state = states[activeFriend.username]
        if (!state) {
            state = await initRatchetAlice(activeFriend.username, pubIdentityKeys[activeFriend.username], SKs[activeFriend.username])
        }

        // chain ratchet
        const messageKey = await performSendingChainRatchet(state)

        console.log(`[sending chain key ${activeFriend.username}] New Chain Key: ${state.sending_ChainKey.slice(0, 16)}...`)
        console.log(`[sending chain key's encryption ${activeFriend.username}] Message Key: ${messageKey.slice(0, 16)}...`)

        const header = {
            ratchetPubKey: state.my_RatchetKeyPair.public,
            messageNumber: state.messagesSent - 1, // -1 because performSendingChainRatchet already incremented
            prevChainLength: state.prevChainLength
        }

        if (state.messagesSent === 1) // Check for 1 because performSendingChainRatchet already incremented
            header.prekeyIndex = state.usedPrekeyIndex

        const encryptedText = await encrypt(inputText, messageKey)

        sendMessage(JSON.stringify({
            header: header,
            payload: encryptedText
        }), activeFriend.username, messageId)

        setStates(prev => ({...prev, [activeFriend.username]: state}))
        localStorage.setItem(`ratchet_state_${activeFriend.username}`, JSON.stringify(state))

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
                        {/* Displays conversations */}
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
                                onInput={e => setInputText(e.target.textContent || '')}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSendMessage(e)
                                        e.target.textContent = ''
                                    }
                                }}
                            />
                        </form>
                    </>
                )}
            </div>
        </div>
    )
}

export default Dashboard