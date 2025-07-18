import {useState} from "react";
import { io } from 'socket.io-client'

let globalSocket = null;

const getNewAccessToken = async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    const refreshResponse = await apiRequest('/api/refresh', {
        refresh_token: refreshToken
    }, true);

    if (refreshResponse.success && refreshResponse.data.access_token) {
        localStorage.setItem('access_token', refreshResponse.data.access_token);
        return refreshResponse.data.access_token;
    }

    return null;
};

const retryApiRequest = async (endpoint, payload) => {
    return apiRequest(endpoint, payload, true);
};

export async function apiRequest(endpoint, payload, isRetry = false) {
    try {
        const accessToken = getAccessToken();
        const headers = { 'Content-Type': 'application/json' };
        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const url = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            return {
                success: false,
                message: 'Server error - invalid response format',
                errorType: 'server_error'
            };
        }

        const responseData = await response.json();

        if (response.status === 401 && !isRetry && !endpoint.includes('/signin') && !endpoint.includes('/signup') && endpoint !== '/api/refresh') {
            const newToken = await getNewAccessToken();
            if (newToken) return await retryApiRequest(endpoint, payload);

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

            return {
                success: false,
                message: message,
                errorType: responseData.error_type || 'unknown_error'
            };
        }

        return {
            success: true,
            data: responseData
        };

    } catch (err) {
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
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
};

export const getAccessToken = () => {
    return localStorage.getItem('access_token');
};

export const getRefreshToken = () => {
    return localStorage.getItem('refresh_token');
};

export const clearTokens = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
};

export const isLoggedIn = () => {
    return getAccessToken() !== null && getRefreshToken() !== null;
};

export const isTokenExpired = (token) => {
    if (!token) return true;

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp * 1000 < Date.now();
    } catch {
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
    return response.errorType === 'bad_format'
        ? response.message
        : errorMap[response.errorType]?.label || 'Server error. Try again later.'
}

export const showMessage = (messageText, setMessage, duration = 4000) => {
    setMessage(messageText)
    setTimeout(() => setMessage(''), duration)
}

export const connectWebSocket = (onStatusChange) => {
    if (globalSocket && globalSocket.connected) {
        onStatusChange('connected', globalSocket);
        return globalSocket;
    }

    const token = getAccessToken();

    if (!token) {
        onStatusChange('error', null);
        return null;
    }

    if (isTokenExpired(token)) {
        onStatusChange('token_expired', null);
        return null;
    }

    if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
    }

    const socketUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5001'
        : window.location.origin

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

    globalSocket = socket;

    socket.on('connect', () => {
        onStatusChange('connected', socket);
    });

    socket.on('connect_error', (error) => {
        if (error.message === 'Invalid namespace') {
            onStatusChange('auth_error', null);
        } else {
            onStatusChange('error', null);
        }
    });

    socket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect') {
            onStatusChange('auth_error', null);
        } else {
            onStatusChange('disconnected', null);
        }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        onStatusChange('reconnecting', null);
    });

    return socket;
}

export const setupWebSocketHandlers = (socket, handlers) => {
    socket.on('connection_response', (data) => {
        if (handlers.onConnectionResponse) {
            handlers.onConnectionResponse(data)
        }
        socket.emit('user_online')
    })

    socket.on('message', (data) => {
        if (handlers.onMessage) {
            handlers.onMessage(data)
        }
    })

    socket.on('typing_update', (data) => {
        if (handlers.onTypingUpdate) {
            handlers.onTypingUpdate(data)
        }
    })

    socket.on('presence_update', (data) => {
        if (handlers.onPresenceUpdate) {
            handlers.onPresenceUpdate(data)
        }
    })

    socket.on('reaction_update', (data) => {
        if (handlers.onReactionUpdate) {
            handlers.onReactionUpdate(data)
        }
    })

    socket.on('messages_read', (data) => {
        if (handlers.onMessagesRead) {
            handlers.onMessagesRead(data)
        }
    })
}

let typingTimeout = null
export const sendTypingIndicator = (socket, channelId, isTyping) => {
    if (typingTimeout) {
        clearTimeout(typingTimeout)
    }

    socket.emit('typing', {
        channel_id: channelId,
        is_typing: isTyping
    })

    if (isTyping) {
        typingTimeout = setTimeout(() => {
            socket.emit('typing', {
                channel_id: channelId,
                is_typing: false
            })
        }, 3000)
    }
}

export const joinChannel = (socket, channelId) => {
    socket.emit('join_channel', { channel_id: channelId })
}

export const leaveChannel = (socket, channelId) => {
    socket.emit('leave_channel', { channel_id: channelId })
}

export const addReaction = (socket, messageId, emoji) => {
    socket.emit('add_reaction', {
        message_id: messageId,
        emoji: emoji
    })
}

export const loadMessages = async (channelId, page = 1) => {
    const url = `/api/messages/${channelId}?page=${page}`

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${getAccessToken()}`
            }
        })

        if (!response.ok) {
            return { success: false, messages: [], unread_counts: {} }
        }

        const data = await response.json()
        return data
    } catch (error) {
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

    if (diffSecs < 60) return ''
    else if (diffMins < 60) return `${diffMins}m ago`
    else if (diffHours < 24) return `${diffHours}h ago`
    else if (diffDays < 7) return `${diffDays}d ago`
    else return then.toLocaleDateString()
}

export const handleLogout = (socket, navigate) => {
    if (socket) {
        socket.disconnect()
    }
    globalSocket = null;
    clearTokens()
    navigate('/login')
}

export const sendMessage = (socket, activeChat, text, connectionStatus) => {
    if (socket && connectionStatus === 'connected') {
        socket.emit('message', {
            channel: activeChat,
            text: text
        })
        return true
    }
    return false
}

export const initializeDashboardData = () => {
    const username = getUsername()
    const { channels, directMessages } = getChannelsAndDMs()

    const initialMessages = {}
    channels.forEach(channel => {
        if (channel.id === 'general') {
            initialMessages[channel.id] = [{
                id: 'welcome-1',
                user: 'System',
                text: 'Welcome to Cartesian Theater!',
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
        setMessage(msg)
        const timer = setTimeout(() => setMessage(''), duration)
        return () => clearTimeout(timer)
    }

    return [message, showMessage, () => setMessage('')]
}

export const saveUsername = (username) => {
    localStorage.setItem('username', username);
};

export const getUsername = () => {
    return localStorage.getItem('username') || 'User';
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
    return {
        channels: mockChannels,
        directMessages: mockDirectMessages
    }
}

export const addMessageToChat = (currentMessages, chatId, newMessage) => {
    return {
        ...currentMessages,
        [chatId]: [...(currentMessages[chatId] || []), newMessage]
    }
}

export const updateMessageReactions = (messages, messageId, reactions) => {
    return messages.map(msg =>
        msg.id === messageId ? { ...msg, reactions } : msg
    )
}

export const updateTypingUsers = (currentTyping, channelId, users) => {
    return {
        ...currentTyping,
        [channelId]: users
    }
}

export const updateUnreadCounts = (counts, newCounts) => {
    return { ...counts, ...newCounts }
}

export const updateOnlineUsers = (users) => {
    const onlineList = {}
    Object.entries(users).forEach(([userId, userData]) => {
        if (userData.status === 'online') {
            onlineList[userId] = userData
        }
    })
    return onlineList
}

export const createNewMessage = (username, text, userId = null) => {
    return {
        id: `temp-${Date.now()}`,
        user: username,
        user_id: userId || localStorage.getItem('user_id'),
        text: text,
        timestamp: new Date().toISOString(),
        reactions: {},
        is_read: false
    }
}

export const getInitialMessagesForChat = (chatId, username) => {
    const now = new Date()
    const messages = []

    if (chatId === 'general') {
        messages.push({
            id: 'welcome-1',
            user: 'System',
            text: 'Welcome to Cartesian Theater!',
            timestamp: new Date(now - 3600000).toISOString(),
            isSystem: true
        })

        messages.push({
            id: 'demo-1',
            user: 'Sarah Chen',
            user_id: 'sarah_chen',
            text: 'Hey everyone! How\'s it going? 👋',
            timestamp: new Date(now - 300000).toISOString(),
            reactions: { '👍': [{ user_id: 'alex_johnson', username: 'Alex Johnson' }] },
            is_read: false
        })

        messages.push({
            id: 'demo-2',
            user: 'Alex Johnson',
            user_id: 'alex_johnson',
            text: 'Pretty good! Just working on the new features. The typing indicators are looking great!',
            timestamp: new Date(now - 180000).toISOString(),
            reactions: { '🎉': [{ user_id: 'sarah_chen', username: 'Sarah Chen' }] },
            is_read: false
        })

        messages.push({
            id: 'demo-3',
            user: 'erik_ai',
            user_id: '999999',
            text: 'I\'ve analyzed the chat patterns. The average response time is 42 seconds. Fascinating! 🤖',
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
            timestamp: new Date(now - 120000).toISOString(),
            is_read: false
        })

        messages.push({
            id: 'dm-sarah-2',
            user: username,
            user_id: username,
            text: 'Yes! It\'s working great. Try clicking this message!',
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
            timestamp: new Date(now - 300000).toISOString(),
            isAI: true
        })
    }

    return messages
}

export const getChatDisplayName = (chatId, channels, dms) => {
    const chat = [...channels, ...dms].find(ch => ch.id === chatId)
    return chat ? chat.name : chatId
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
        // Silent fail
    }
}