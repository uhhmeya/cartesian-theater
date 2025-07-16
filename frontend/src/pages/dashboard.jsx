import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { StarryBackground, ChatSidebar, ChatMain } from '../helpers/components.jsx'
import {
    clearTokens,
    mockChannels,
    mockDirectMessages,
    getInitialMessages,
    getChannelName,
    getUsername,
    connectWebSocket
} from '../helpers/utility.jsx'

function Dashboard() {
    const navigate = useNavigate()
    const [activeChannel, setActiveChannel] = useState('general')
    const [sidebarWidth, setSidebarWidth] = useState(240)
    const [username, setUsername] = useState('')
    const [messages, setMessages] = useState({})
    const [connectionStatus, setConnectionStatus] = useState('connecting')
    const socketRef = useRef(null)

    useEffect(() => {
        const storedUsername = getUsername()
        setUsername(storedUsername)

        // Initialize messages for all channels
        const initialMessages = {}
        const allChannels = [...mockChannels, ...mockDirectMessages]
        allChannels.forEach(channel => {
            initialMessages[channel.id] = getInitialMessages(channel.id, storedUsername)
        })
        setMessages(initialMessages)

        // Connect to WebSocket
        const socket = connectWebSocket((status, socketInstance) => {
            setConnectionStatus(status)
            if (status === 'connected' && socketInstance) {
                socketRef.current = socketInstance
                console.log('WebSocket connected successfully')

                // Listen for server messages
                socketInstance.on('connection_response', (data) => {
                    console.log('Connection response:', data)
                })

                socketInstance.on('message', (data) => {
                    console.log('Received message:', data)
                    // Handle incoming messages here
                })
            } else if (status === 'error') {
                console.error('WebSocket connection failed')
            }
        })

        // Cleanup on unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect()
            }
        }
    }, [])

    const handleLogout = () => {
        if (socketRef.current) {
            socketRef.current.disconnect()
        }
        clearTokens()
        navigate('/login')
    }

    const handleSendMessage = (text) => {
        const newMessage = {
            id: Date.now(),
            user: username,
            text: text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }

        setMessages(prev => ({
            ...prev,
            [activeChannel]: [...(prev[activeChannel] || []), newMessage]
        }))

        // Send message via WebSocket if connected
        if (socketRef.current && connectionStatus === 'connected') {
            socketRef.current.emit('message', {
                channel: activeChannel,
                text: text
            })
        }

        // Simulate AI response if messaging erik_ai
        if (activeChannel === 'erik_ai') {
            setTimeout(() => {
                const aiResponse = {
                    id: Date.now() + 1,
                    user: 'erik_ai',
                    text: 'I understand your message. How can I help you further?',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isAI: true
                }
                setMessages(prev => ({
                    ...prev,
                    erik_ai: [...prev.erik_ai, aiResponse]
                }))
            }, 1000)
        }
    }

    const currentMessages = messages[activeChannel] || []
    const channelName = getChannelName(activeChannel, mockChannels, mockDirectMessages)

    return (
        <div className="chat-container">
            <StarryBackground />

            <ChatSidebar
                activeChannel={activeChannel}
                onChannelSelect={setActiveChannel}
                channels={mockChannels}
                directMessages={mockDirectMessages}
                onLogout={handleLogout}
                sidebarWidth={sidebarWidth}
                username={username}
            />

            <ChatMain
                activeChannel={activeChannel}
                messages={currentMessages}
                onSendMessage={handleSendMessage}
                currentUser={username}
                channelName={channelName}
            />
        </div>
    )
}

export default Dashboard