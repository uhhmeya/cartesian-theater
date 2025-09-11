import {useEffect, useMemo, useRef, useState} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {useWebSocket} from '../hooks/useWebSocket'
import {useSocialData} from '../hooks/useSocialData'
import {useCrypto} from '../hooks/useCrypto'
import {UserAvatar} from '../components/UserAvatar'
import {SidebarItem} from '../components/SidebarItem.jsx'
import {Message} from '../components/Message.jsx'
import {decrypt, encrypt} from '../services/crypto/keys.js'
import {getPrekey, store} from '../services/storage'
import {ephConvo, permaConvo, loadAllPersistentMessages, storePersistentMessage} from "../services/conversation.js";
import {computeAndStoreSK} from "../services/crypto/skUtils.js";
import {initRatchetAlice, initRatchetBob, performReceivingChainRatchet, performReceivingDHRatchet, performSendingChainRatchet} from '../services/crypto/ratchet.js'
import '../styles/dashboard/sidebar.css'
import '../styles/dashboard/messages.css'
import '../styles/dashboard/friends.css'

function Dashboard() {

    let messageCounter = 0

    const navigate = useNavigate()
    const location = useLocation()
    const messagesEndRef = useRef(null)
    const myIdentityPrivKey = location.state?.privateKey

    const [saveChats, setSaveChats] = useState(false)
    const [messages, setMessages] = useState([])
    const [inputText, setInputText] = useState('')
    const [myUsername] = useState(localStorage.getItem('username') || 'User')
    const [showNonfriendList, setShowNonfriendList] = useState(false)
    const [activeFriend, setActiveFriend] = useState(null)

    const { allUsers, friends, sendFriendRequest, acceptRequest, onlineFriends, offlineFriends, refresh } = useSocialData()

    const {states, setStates, identitySecrets, pubIdentityKeys, SKs, setSKs} = useCrypto(friends, myIdentityPrivKey, activeFriend)

    const handleIncomingMessage = async (data) => {

        console.log(`Message #${++messageCounter} from ${data.sender}`);

        const {header, payload: encryptedText} = JSON.parse(data.text)
        let state = states[data.sender]

        // handles race condition
        if (!state && (header.prekeyIndex === undefined || header.prekeyIndex === null)) {
            console.log("message dropped : no state or prekey index exists.")
            return
        }

        if (!state) { // new message for no state means initialize
            const prekey = await getPrekey(header.prekeyIndex, myIdentityPrivKey)
            let SK = SKs[data.sender]
            if (!SK)
                SK = await computeAndStoreSK(data.sender, identitySecrets, pubIdentityKeys, myIdentityPrivKey, setSKs)
            state = await initRatchetBob(data.sender, SK, prekey, header.ratchetPubKey)
        } else { // new message for existing state means DH ratchet
            if (header.ratchetPubKey !== state.other_RatchetPubKey)
                await performReceivingDHRatchet(state, header.ratchetPubKey, data.sender)
        }

        const messageKey = await performReceivingChainRatchet(state)
        const decryptedText = await decrypt(encryptedText, messageKey)

        await store(`ratchet_state_${data.sender}`, state, myIdentityPrivKey)
        setStates(prev => ({...prev, [data.sender]: state}))

        const newMessage = {...data, id: data.id || `${data.sender}-${Date.now()}-${Math.random()}`, text: decryptedText, persistent: header.persistent || false}

        if (newMessage.persistent) {
            await storePersistentMessage(data.sender, newMessage, myIdentityPrivKey)
        }

        setMessages(prev => [...prev, newMessage])
    }

    const handleStatusUpdate = (data) => {
        setMessages(prev => {return prev.map(msg => {
        if (msg.id === data.messageId) return {...msg, status: data.status}
        return msg})})
    }

    const {connectionStatus, sendMessage, socket } = useWebSocket(handleIncomingMessage, handleStatusUpdate, refresh)

    const ephemeralConversation = useMemo(() => ephConvo(messages, myUsername, activeFriend),
        [messages, myUsername, activeFriend]
    )

    const persistentConversation = useMemo(() => permaConvo(messages, myUsername, activeFriend),
        [messages, myUsername, activeFriend]
    )

    const conversation = saveChats ? persistentConversation : ephemeralConversation

    const handleLogout = (navigate) => {
        if (socket) socket.disconnect()
        localStorage.removeItem('username')
        localStorage.removeItem('token')
        localStorage.removeItem('access_token')
        navigate('/')
    }

    // load history
    useEffect(() => {
        if (!friends.length || !myIdentityPrivKey) return
        const loadHistory = async () => {
            const storedMessages = await loadAllPersistentMessages(friends, myIdentityPrivKey)
            setMessages(prev => {const existingIds = new Set(prev.map(msg => msg.id)); const newMessages = storedMessages.filter(msg => !existingIds.has(msg.id)) ;return [...prev, ...newMessages]})}
        loadHistory()
    }, [friends, myIdentityPrivKey])

    // auto scroll
    useEffect(() => {
        if (conversation.length > 0) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
    }, [conversation])

    const handleSendMessage = async e => {
        e.preventDefault()
        if (!inputText.trim() || !activeFriend) return
        const messageId = `${Date.now()}-${Math.random()}`

        const newMessage = {id: messageId, sender: myUsername, text: inputText, time: new Date().toISOString(), receiver: activeFriend.username, status: 'sending', persistent: saveChats}
        setMessages(prev => [...prev, newMessage])
        const messageText = inputText; setInputText('')

        if (saveChats) {
            await storePersistentMessage(activeFriend.username, newMessage, myIdentityPrivKey)
        }


        let state = states[activeFriend.username]

        if (!state)
            state = await initRatchetAlice(activeFriend.username, pubIdentityKeys[activeFriend.username], SKs[activeFriend.username])

        const messageKey = await performSendingChainRatchet(state)
        const encryptedText = await encrypt(messageText, messageKey)

        const header = {
            ratchetPubKey: state.my_RatchetKeyPair.public,
            messageNumber: state.messagesSent - 1,
            prevChainLength: state.prevChainLength,
            persistent: saveChats
        }

        if (state.messagesSent === 1) {
            console.log('Adding prekeyIndex to header:', state.usedPrekeyIndex)
            header.prekeyIndex = state.usedPrekeyIndex
        }

        setStates(prev => ({...prev, [activeFriend.username]: state}))
        await store(`ratchet_state_${activeFriend.username}`, state, myIdentityPrivKey)

        setTimeout(() => {sendMessage(JSON.stringify({header: header, payload: encryptedText}), activeFriend.username, messageId)}, 0)
    }

    const getNonfriendButton = (status) => {
        const configs = {
            'they_sent_me_a_request': { text: 'Accept Friend', className: '' },
            'i_sent_them_a_request': { text: 'Pending', className: 'pending-btn' },
            'i_rejected_them': { text: 'Rejected', className: 'rejected-btn' },
            'they_rejected_me': { text: 'Rejected', className: 'rejected-btn' }}
        return configs[status] || { text: 'Add Friend', className: '' }
    }

    return (
        <div className="chat-container">

            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <div className="save-chats-toggle" onClick={() => setSaveChats(!saveChats)}>
                        <span className="toggle-label">Save chats</span>
                        <div className={`toggle-switch ${saveChats ? 'active' : ''}`}>
                            <div className="toggle-slider"></div>
                        </div>
                    </div>
                </div>

                <div className="channel-section">
                    <div className="section-header">
                        <span>Friends</span>
                        <button className="add-friend-btn" onClick={() => setShowNonfriendList(true)}>+</button>
                    </div>
                    <div className="channel-list">
                        {saveChats ? (
                            friends.map(friend => (
                                <SidebarItem
                                    key={friend.id}
                                    active={friend.id === activeFriend?.id && !showNonfriendList}
                                    onClick={() => {
                                        setShowNonfriendList(false)
                                        setActiveFriend(friend)
                                    }}
                                >
                                    <span className="channel-name">{friend.username}</span>
                                </SidebarItem>
                            ))
                        ) : (
                            <>
                                {onlineFriends.map(friend => (
                                    <SidebarItem
                                        key={friend.id}
                                        active={friend.id === activeFriend?.id && !showNonfriendList}
                                        onClick={() => {
                                            setShowNonfriendList(false)
                                            setActiveFriend(friend)
                                        }}
                                    >
                                        <span className="channel-name">{friend.username}</span>
                                    </SidebarItem>
                                ))}
                                {offlineFriends.map(friend => (
                                    <SidebarItem
                                        key={friend.id}
                                        active={false}
                                        onClick={() => {}}
                                        className="offline-disabled"
                                    >
                                        <span className="channel-name offline-text">{friend.username}</span>
                                    </SidebarItem>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                <div className="sidebar-footer">
                    <button className="logout-button" onClick={() => handleLogout(navigate)}>
                        <span>←</span> Logout
                    </button>
                </div>
            </div>

            <button className="bottom-logout" onClick={() => handleLogout(navigate)}>
                <span>←</span> LOGOUT
            </button>

            <div className="chat-main">

                {connectionStatus !== 'connected' && (
                    <div className={`connection-status-bar ${
                        connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`}>
                        {connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    </div>)}

                {showNonfriendList ? (
                    <div className="user-list-container">

                        {allUsers.filter(nonfriend => nonfriend.relationshipStatus !== 'we_are_friends').map(nonfriend => (
                            <div key={nonfriend.id} className="user-item">
                                <UserAvatar username={nonfriend.username} className="user-avatar" />
                                <span className="user-name">{nonfriend.username}</span>
                                <button
                                    onClick={() => {
                                        if (nonfriend.relationshipStatus === 'they_sent_me_a_request')
                                            acceptRequest(nonfriend.requestId)
                                        else
                                            sendFriendRequest(nonfriend.id) }}

                                    disabled={nonfriend.relationshipStatus === 'i_sent_them_a_request'}

                                    className={getNonfriendButton(nonfriend.relationshipStatus).className}>
                                    {getNonfriendButton(nonfriend.relationshipStatus).text}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
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