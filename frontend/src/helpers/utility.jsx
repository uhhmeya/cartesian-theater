import {useState} from "react";
import { io } from 'socket.io-client'

const debug = (category, message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    const prefix = `[${timestamp}] ${category}:`
    if (data) {
        console.log(prefix, message, data)
    } else {
        console.log(prefix, message)
    }
}

// Global socket instance to prevent duplicates
let globalSocket = null;

const getNewAccessToken = async () => {
    debug('🔄 AUTH', 'Attempting to refresh access token')

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        debug('❌ AUTH', 'No refresh token available')
        return null;
    }

    const refreshResponse = await apiRequest('/api/refresh', {
        refresh_token: refreshToken
    }, true);

    if (refreshResponse.success && refreshResponse.data.access_token) {
        debug('✅ AUTH', 'Access token refreshed successfully')
        localStorage.setItem('access_token', refreshResponse.data.access_token);
        return refreshResponse.data.access_token;
    }

    debug('❌ AUTH', 'Failed to refresh access token', refreshResponse)
    return null;
};

const retryApiRequest = async (endpoint, payload) => {
    debug('🔁 API', 'Retrying request', { endpoint })
    return apiRequest(endpoint, payload, true);
};

export async function apiRequest(endpoint, payload, isRetry = false) {
    debug('📤 API', `Request to ${endpoint}`, { payload, isRetry })

    try {
        const accessToken = getAccessToken();
        const headers = { 'Content-Type': 'application/json' };
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
            debug('🔐 API', `Using access token: ${accessToken.substring(0, 20)}...`)
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;

        debug('🌐 API', `Fetching: ${url}`)

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        debug('📥 API', `Response status: ${response.status}`)

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            debug('❌ API', 'Invalid response content type', contentType)
            return {
                success: false,
                message: 'Server error - invalid response format',
                errorType: 'server_error'
            };
        }

        const responseData = await response.json();
        debug('📊 API', 'Response data', responseData)

        if (response.status === 401 && !isRetry && !endpoint.includes('/signin') && !endpoint.includes('/signup') && endpoint !== '/api/refresh') {
            debug('⚠️ AUTH', 'Token expired, attempting refresh')
            const newToken = await getNewAccessToken();
            if (newToken) return await retryApiRequest(endpoint, payload);

            debug('❌ AUTH', 'Token refresh failed, clearing tokens')
            clearTokens();
            window.location.href = '/login';
            return {
                success: false,
                message: 'Session expired - please login again',
                errorType: 'auth_failed'
            };
        }

        if (!response.ok) {
            const message = response.status >= 500
                ? 'Server error. Please try again later.'
                : responseData.message || `Request failed with status ${response.status}`;

            debug('❌ API', 'Request failed', { status: response.status, message })

            return {
                success: false,
                message: message,
                errorType: responseData.error_type || 'unknown_error'
            };
        }

        debug('✅ API', 'Request successful')
        return {
            success: true,
            data: responseData
        };

    } catch (err) {
        debug('❌ API', 'Request error', err)

        if (err.name === 'AbortError') {
            return {
                success: false,
                message: 'Request timed out - please try again',
                errorType: 'timeout_error'
            };
        }

        return {
            success: false,
            message: 'Network error - please check your connection',
            errorType: 'network_error'
        };
    }
}

export const saveTokens = (accessToken, refreshToken) => {
    debug('💾 TOKEN', 'Saving tokens')
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
};

export const getAccessToken = () => {
    const token = localStorage.getItem('access_token');
    debug('🔐 TOKEN', `Retrieved access token: ${token ? token.substring(0, 20) + '...' : 'null'}`)
    return token;
};

export const getRefreshToken = () => {
    const token = localStorage.getItem('refresh_token');
    debug('🔐 TOKEN', `Retrieved refresh token: ${token ? token.substring(0, 20) + '...' : 'null'}`)
    return token;
};

export const clearTokens = () => {
    debug('🧹 TOKEN', 'Clearing all tokens')
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
};

export const isLoggedIn = () => {
    const loggedIn = getAccessToken() !== null && getRefreshToken() !== null;
    debug('🔐 AUTH', `User logged in: ${loggedIn}`)
    return loggedIn;
};

export const isTokenExpired = (token) => {
    if (!token) {
        debug('⚠️ TOKEN', 'No token provided to check expiration')
        return true;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isExpired = payload.exp * 1000 < Date.now();
        debug('⏰ TOKEN', `Token expired: ${isExpired}`, { exp: new Date(payload.exp * 1000) })
        return isExpired;
    } catch {
        debug('❌ TOKEN', 'Failed to parse token')
        return true;
    }
};

export const errorMap = {
    bad_format: {
        label: "Bad Format",
        useServerMessage: true
    },
    invalid_credentials: {
        label: "Bad Credentials"
    },
    username_already_exists: {
        label: "Username already exists"
    },
    server_error: {
        label: "Server error. Try again later."
    },
    timeout_error: {
        label: "Request timed out"
    },
    signin: {
        label: "Login successful"
    },
    signup: {
        label: "Account created successfully"
    }
};

export const getErrorMessage = (response) => {
    const message = response.errorType === 'bad_format'
        ? response.message
        : errorMap[response.errorType]?.label || 'Server error. Try again later.'
    debug('🚨 ERROR', `Error message: ${message}`, { errorType: response.errorType })
    return message
}

export const showMessage = (messageText, setMessage, duration = 4000) => {
    debug('💬 UI', `Showing message: ${messageText}`)
    setMessage(messageText)
    setTimeout(() => setMessage(''), duration)
}

export const connectWebSocket = (onStatusChange) => {
    debug('🔌 WEBSOCKET', 'Initiating WebSocket connection')

    // Check if socket already exists
    if (globalSocket && globalSocket.connected) {
        debug('✅ WEBSOCKET', 'Using existing connected socket')
        onStatusChange('connected', globalSocket);
        return globalSocket;
    }

    const token = getAccessToken();

    if (!token) {
        debug('❌ WEBSOCKET', 'No token available for connection')
        onStatusChange('error', null);
        return null;
    }

    if (isTokenExpired(token)) {
        debug('❌ WEBSOCKET', 'Token expired before connection')
        onStatusChange('token_expired', null);
        return null;
    }

    // Disconnect existing socket if any
    if (globalSocket) {
        debug('🔌 WEBSOCKET', 'Disconnecting existing socket')
        globalSocket.disconnect();
        globalSocket = null;
    }

    const socketUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5001'
        : window.location.origin
    debug('🌐 WEBSOCKET', `Connecting to: ${socketUrl}`)

    const socket = io(socketUrl, {
        transports: ['websocket', 'polling'],
        query: {
            token: token
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
    });

    // Store globally to prevent duplicates
    globalSocket = socket;

    socket.on('connect', () => {
        debug('✅ WEBSOCKET', 'Connected successfully', { id: socket.id })
        onStatusChange('connected', socket);
    });

    socket.on('connect_error', (error) => {
        debug('❌ WEBSOCKET', 'Connection error', { message: error.message, type: error.type })
        if (error.message === 'Invalid namespace') {
            onStatusChange('auth_error', null);
        } else {
            onStatusChange('error', null);
        }
    });

    socket.on('disconnect', (reason) => {
        debug('🔌 WEBSOCKET', 'Disconnected', { reason })
        if (reason === 'io server disconnect') {
            onStatusChange('auth_error', null);
        } else {
            onStatusChange('disconnected', null);
        }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        debug('🔄 WEBSOCKET', `Reconnection attempt #${attemptNumber}`)
        onStatusChange('reconnecting', null);
    });

    return socket;
}

export const setupWebSocketHandlers = (socket, handlers) => {
    debug('⚙️ WEBSOCKET', 'Setting up WebSocket handlers')

    socket.on('connection_response', (data) => {
        debug('📨 WEBSOCKET', 'Connection response received', data)
        if (handlers.onConnectionResponse) {
            handlers.onConnectionResponse(data)
        }
        socket.emit('user_online')
        debug('🟢 WEBSOCKET', 'Emitted user_online status')
    })

    socket.on('message', (data) => {
        debug('💬 WEBSOCKET', 'Message received', data)
        if (handlers.onMessage) {
            handlers.onMessage(data)
        }
    })

    socket.on('typing_update', (data) => {
        debug('⌨️ WEBSOCKET', 'Typing update', data)
        if (handlers.onTypingUpdate) {
            handlers.onTypingUpdate(data)
        }
    })

    socket.on('presence_update', (data) => {
        debug('👥 WEBSOCKET', 'Presence update', { userCount: Object.keys(data.online_users).length })
        if (handlers.onPresenceUpdate) {
            handlers.onPresenceUpdate(data)
        }
    })

    socket.on('reaction_update', (data) => {
        debug('😀 WEBSOCKET', 'Reaction update', data)
        if (handlers.onReactionUpdate) {
            handlers.onReactionUpdate(data)
        }
    })

    socket.on('messages_read', (data) => {
        debug('✅ WEBSOCKET', 'Messages marked as read', data)
        if (handlers.onMessagesRead) {
            handlers.onMessagesRead(data)
        }
    })
}

let typingTimeout = null
export const sendTypingIndicator = (socket, channelId, isTyping) => {
    debug('⌨️ TYPING', `Sending typing indicator`, { channelId, isTyping })

    if (typingTimeout) {
        clearTimeout(typingTimeout)
    }

    socket.emit('typing', {
        channel_id: channelId,
        is_typing: isTyping
    })

    if (isTyping) {
        typingTimeout = setTimeout(() => {
            debug('⌨️ TYPING', 'Auto-stopping typing indicator')
            socket.emit('typing', {
                channel_id: channelId,
                is_typing: false
            })
        }, 3000)
    }
}

export const joinChannel = (socket, channelId) => {
    debug('➕ CHANNEL', `Joining channel: ${channelId}`)
    socket.emit('join_channel', { channel_id: channelId })
}

export const leaveChannel = (socket, channelId) => {
    debug('➖ CHANNEL', `Leaving channel: ${channelId}`)
    socket.emit('leave_channel', { channel_id: channelId })
}

export const addReaction = (socket, messageId, emoji) => {
    debug('😀 REACTION', `Adding reaction`, { messageId, emoji })
    socket.emit('add_reaction', {
        message_id: messageId,
        emoji: emoji
    })
}

export const loadMessages = async (channelId, page = 1) => {
    const url = `/api/messages/${channelId}?page=${page}`
    debug('📨 MESSAGES', `Loading messages from: ${url}`)

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${getAccessToken()}`
            }
        })

        debug('📥 MESSAGES', `Response status: ${response.status}`)

        if (!response.ok) {
            debug('❌ MESSAGES', 'Failed to load messages', { status: response.status })
            return { success: false, messages: [], unread_counts: {} }
        }

        const data = await response.json()
        debug('✅ MESSAGES', `Loaded ${data.messages?.length || 0} messages`)
        return data
    } catch (error) {
        debug('❌ MESSAGES', 'Error loading messages', error)
        return { success: false, messages: [], unread_counts: {} }
    }
}

export const getRelativeTime = (timestamp) => {
    const now = new Date()
    const then = new Date(timestamp)
    const diffMs = now - then
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    let result = 'just now'
    if (diffSecs < 60) result = 'just now'
    else if (diffMins < 60) result = `${diffMins}m ago`
    else if (diffHours < 24) result = `${diffHours}h ago`
    else if (diffDays < 7) result = `${diffDays}d ago`
    else result = then.toLocaleDateString()

    debug('⏰ TIME', `Formatted time: ${result}`, { timestamp, diff: diffMs })
    return result
}

export const handleLogout = (socket, navigate) => {
    debug('👋 AUTH', 'Logging out user')
    if (socket) {
        socket.disconnect()
    }
    // Clear global socket reference
    globalSocket = null;
    clearTokens()
    navigate('/login')
}

export const sendMessage = (socket, activeChat, text, connectionStatus) => {
    debug('💬 MESSAGE', 'Sending message', { activeChat, text: text.substring(0, 50) + '...', connectionStatus })

    if (socket && connectionStatus === 'connected') {
        socket.emit('message', {
            channel: activeChat,
            text: text
        })
        debug('✅ MESSAGE', 'Message sent successfully')
        return true
    }
    debug('❌ MESSAGE', 'Failed to send message - not connected')
    return false
}

export const initializeDashboardData = () => {
    debug('🏠 DASHBOARD', 'Initializing dashboard data')

    const username = getUsername()
    const { channels, directMessages } = getChannelsAndDMs()

    const initialMessages = {}
    channels.forEach(channel => {
        if (channel.id === 'general') {
            initialMessages[channel.id] = [{
                id: 'welcome-1',
                user: 'System',
                text: 'Welcome to Cartesian Theater!',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                timestamp: new Date().toISOString(),
                isSystem: true
            }]
        } else {
            initialMessages[channel.id] = []
        }
    })

    directMessages.forEach(dm => {
        initialMessages[dm.id] = []
    })

    debug('✅ DASHBOARD', 'Dashboard initialized', {
        username,
        channelCount: channels.length,
        dmCount: directMessages.length
    })

    return {
        username,
        initialMessages,
        channels,
        directMessages
    }
}

export const useMessage = (duration = 5000) => {
    const [message, setMessage] = useState('')

    const showMessage = (msg) => {
        debug('💬 HOOK', `useMessage: ${msg}`)
        setMessage(msg)
        const timer = setTimeout(() => setMessage(''), duration)
        return () => clearTimeout(timer)
    }

    return [message, showMessage, () => setMessage('')]
}

export const saveUsername = (username) => {
    debug('💾 USER', `Saving username: ${username}`)
    localStorage.setItem('username', username);
};

export const getUsername = () => {
    const username = localStorage.getItem('username') || 'User';
    debug('👤 USER', `Retrieved username: ${username}`)
    return username;
};

const mockChannels = [
    { id: 'general', name: 'general' },
    { id: 'random', name: 'random' },
    { id: 'tech', name: 'tech' },
    { id: 'gaming', name: 'gaming' }
]

const mockDirectMessages = [
    { id: 'erik_ai', name: 'erik_ai', isAI: true },
    { id: 'sarah_chen', name: 'Sarah Chen' },
    { id: 'alex_johnson', name: 'Alex Johnson' }
]

export const getChannelsAndDMs = () => {
    debug('📋 CHAT', 'Getting channels and DMs')
    return {
        channels: mockChannels,
        directMessages: mockDirectMessages
    }
}

export const addMessageToChat = (currentMessages, chatId, newMessage) => {
    debug('➕ MESSAGE', 'Adding message to chat', { chatId, messageId: newMessage.id })
    return {
        ...currentMessages,
        [chatId]: [...(currentMessages[chatId] || []), newMessage]
    }
}

export const updateMessageReactions = (messages, messageId, reactions) => {
    debug('😀 MESSAGE', 'Updating message reactions', { messageId, reactions })
    return messages.map(msg =>
        msg.id === messageId ? { ...msg, reactions } : msg
    )
}

export const updateTypingUsers = (currentTyping, channelId, users) => {
    debug('⌨️ TYPING', 'Updating typing users', { channelId, users })
    return {
        ...currentTyping,
        [channelId]: users
    }
}

export const updateUnreadCounts = (counts, newCounts) => {
    debug('📊 UNREAD', 'Updating unread counts', newCounts)
    return { ...counts, ...newCounts }
}

export const updateOnlineUsers = (users) => {
    debug('👥 ONLINE', 'Updating online users', { totalUsers: Object.keys(users).length })
    const onlineList = {}
    Object.entries(users).forEach(([userId, userData]) => {
        if (userData.status === 'online') {
            onlineList[userId] = userData
        }
    })
    return onlineList
}

export const createNewMessage = (username, text, userId = null) => {
    const message = {
        id: `temp-${Date.now()}`,
        user: username,
        user_id: userId || localStorage.getItem('user_id'),
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        reactions: {},
        is_read: false
    }
    debug('🆕 MESSAGE', 'Created new message', message)
    return message
}

export const getInitialMessagesForChat = (chatId, username) => {
    debug('📝 MESSAGE', `Getting initial messages for chat: ${chatId}`)

    const now = new Date()
    const messages = []

    if (chatId === 'general') {
        messages.push({
            id: 'welcome-1',
            user: 'System',
            text: 'Welcome to Cartesian Theater!',
            time: new Date(now - 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date(now - 3600000).toISOString(),
            isSystem: true
        })

        messages.push({
            id: 'demo-1',
            user: 'Sarah Chen',
            user_id: 'sarah_chen',
            text: 'Hey everyone! How\'s it going? 👋',
            time: new Date(now - 300000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date(now - 300000).toISOString(),
            reactions: { '👍': [{ user_id: 'alex_johnson', username: 'Alex Johnson' }] },
            is_read: false
        })

        messages.push({
            id: 'demo-2',
            user: 'Alex Johnson',
            user_id: 'alex_johnson',
            text: 'Pretty good! Just working on the new features. The typing indicators are looking great!',
            time: new Date(now - 180000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date(now - 180000).toISOString(),
            reactions: { '🎉': [{ user_id: 'sarah_chen', username: 'Sarah Chen' }] },
            is_read: false
        })

        messages.push({
            id: 'demo-3',
            user: 'erik_ai',
            user_id: '999999',
            text: 'I\'ve analyzed the chat patterns. The average response time is 42 seconds. Fascinating! 🤖',
            time: new Date(now - 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date(now - 60000).toISOString(),
            reactions: { '🤖': [{ user_id: 'sarah_chen', username: 'Sarah Chen' }, { user_id: 'alex_johnson', username: 'Alex Johnson' }] },
            is_read: false,
            isAI: true
        })
    } else if (chatId === 'sarah_chen') {
        messages.push({
            id: 'dm-sarah-1',
            user: 'Sarah Chen',
            user_id: 'sarah_chen',
            text: 'Hey! Did you see the new message reactions feature?',
            time: new Date(now - 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date(now - 120000).toISOString(),
            is_read: false
        })

        messages.push({
            id: 'dm-sarah-2',
            user: username,
            user_id: username,
            text: 'Yes! It\'s working great. Try clicking this message!',
            time: new Date(now - 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date(now - 60000).toISOString(),
            is_read: true,
            reactions: { '❤️': [{ user_id: 'sarah_chen', username: 'Sarah Chen' }] }
        })
    } else if (chatId === 'erik_ai') {
        messages.push({
            id: 'dm-erik-1',
            user: 'erik_ai',
            user_id: '999999',
            text: 'Hello! I\'m Erik, your AI assistant. How can I help you today?',
            time: new Date(now - 300000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestamp: new Date(now - 300000).toISOString(),
            isAI: true
        })
    }

    return messages
}

export const getChatDisplayName = (chatId, channels, dms) => {
    const chat = [...channels, ...dms].find(ch => ch.id === chatId)
    const name = chat ? chat.name : chatId
    debug('💬 CHAT', `Display name for ${chatId}: ${name}`)
    return name
}

export const getConnectionStatusText = (status) => {
    const statusMap = {
        'connecting': 'Connecting...',
        'connected': 'Connected',
        'disconnected': 'Disconnected',
        'reconnecting': 'Reconnecting...',
        'error': 'Connection error',
        'auth_error': 'Authentication failed',
        'token_expired': 'Session expired'
    }
    return statusMap[status] || 'Unknown'
}

export const getConnectionStatusColor = (status) => {
    const colorMap = {
        'connected': '#22c55e',
        'connecting': '#f59e0b',
        'reconnecting': '#f59e0b',
        'disconnected': '#ef4444',
        'error': '#ef4444',
        'auth_error': '#ef4444',
        'token_expired': '#ef4444'
    }
    return colorMap[status] || '#6b7280'
}

let audioContext = null
export const playNotificationSound = (type = 'message') => {
    debug('🔊 SOUND', `Playing notification sound: ${type}`)

    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)()
        }

        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        if (type === 'message') {
            oscillator.frequency.value = 600
            gainNode.gain.value = 0.1
            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + 0.1)
        } else if (type === 'dm') {
            oscillator.frequency.value = 800
            gainNode.gain.value = 0.15
            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + 0.15)
        }
    } catch (e) {
        debug('❌ SOUND', 'Could not play notification sound', e)
    }
}