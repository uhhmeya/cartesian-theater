import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { StarryBackground, ChatSidebar, ChatMain } from '../helpers/components.jsx'
import {
    connectWebSocket,
    setupWebSocketHandlers,
    handleLogout,
    sendMessage,
    initializeDashboardData,
    getChatDisplayName,
    createNewMessage,
    scheduleAIResponse,
    addMessageToChat
} from '../helpers/utility.jsx'

function Dashboard() {
    const navigate = useNavigate()

    // Core state
    const [activeChat, setActiveChat] = useState('general')
    const [allMessages, setAllMessages] = useState({})
    const [username, setUsername] = useState('')
    const [connectionStatus, setConnectionStatus] = useState('connecting')
    const [channels, setChannels] = useState([])
    const [directMessages, setDirectMessages] = useState([])

    // Refs
    const socketRef = useRef(null)

    // Derived state
    const activeMessages = allMessages[activeChat] || []
    const chatDisplayName = getChatDisplayName(activeChat, channels, directMessages)


    useEffect(() => {

        // Load data
        const { username: storedUsername, initialMessages, channels, directMessages } = initializeDashboardData()
        setUsername(storedUsername)
        setAllMessages(initialMessages)
        setChannels(channels)
        setDirectMessages(directMessages)

        // Connect WebSocket
        const socket = connectWebSocket((status, socketInstance) => {
            setConnectionStatus(status)

            if (status === 'connected' && socketInstance) {
                socketRef.current = socketInstance

                // Setup message handlers
                setupWebSocketHandlers(socketInstance, {
                    onMessage: handleIncomingMessage,
                    onConnectionResponse: (data) => console.log('Connected:', data)
                })
            } else if (status === 'auth_error' || status === 'token_expired')
                handleLogout(null, navigate)
        })

        // Cleanup
        return () => {if (socketRef.current) socketRef.current.disconnect()}}, [navigate])

    // Message handlers
    const handleIncomingMessage = (data) => {
        console.log('Received message:', data)
    }

    const handleSendMessage = (text) => {

        const newMessage = createNewMessage(username, text)
        setAllMessages(prev => addMessageToChat(prev, activeChat, newMessage))
        sendMessage(socketRef.current, activeChat, text, connectionStatus)

        // Handle AI chat
        if (activeChat === 'erik_ai')
            scheduleAIResponse((aiResponse) =>
                setAllMessages(prev => addMessageToChat(prev, 'erik_ai', aiResponse)))

    }

    return (
        <div className="chat-container">
            <StarryBackground />

            <ChatSidebar
                activeChat={activeChat}
                onChatSelect={setActiveChat}
                channels={channels}
                directMessages={directMessages}
                onLogout={() => handleLogout(socketRef.current, navigate)}
                username={username}
            />

            <ChatMain
                activeChat={activeChat}
                messages={activeMessages}
                onSendMessage={handleSendMessage}
                currentUser={username}
                chatDisplayName={chatDisplayName}
            />
        </div>
    )
}

export default Dashboard