import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StarryBackground, ChatSidebar, ChatMain } from '../helpers/components.jsx'
import { clearTokens, mockChannels, mockDirectMessages, mockMessages, getChannelName } from '../helpers/utility.jsx'

function Dashboard() {
    const navigate = useNavigate()
    const [activeChannel, setActiveChannel] = useState('general')

    const handleLogout = () => {
        clearTokens()
        navigate('/login')
    }

    const handleSendMessage = (text) => {
        // Placeholder for sending messages
        console.log('Sending message:', text)
    }

    const currentMessages = mockMessages[activeChannel] || []
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
            />

            <ChatMain
                activeChannel={channelName}
                messages={currentMessages}
                onSendMessage={handleSendMessage}
            />
        </div>
    )
}

export default Dashboard