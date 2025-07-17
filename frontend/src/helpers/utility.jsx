import {useState} from "react";

const getNewAccessToken = async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    const refreshResponse = await apiRequest('http://localhost:5001/refresh', {
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
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const proxyEndpoint = endpoint.replace('http://localhost:5001', '/api').replace('http://127.0.0.1:5001', '/api');

        const response = await fetch(proxyEndpoint, {
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

import { io } from 'socket.io-client'

export const connectWebSocket = (onStatusChange) => {
    const token = getAccessToken();

    if (!token) {
        onStatusChange('error', null);
        return null;
    }

    if (isTokenExpired(token)) {
        onStatusChange('token_expired', null);
        return null;
    }

    const socket = io('http://localhost:5001', {
        transports: ['websocket', 'polling'],
        query: {
            token: token
        },
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 10000
    });

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

    socket.on('connection_response', (data) => {
        // Handle connection response
    });

    return socket;
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

export const mockChannels = [
    { id: 'general', name: 'general' },
    { id: 'random', name: 'random' },
    { id: 'tech', name: 'tech' },
    { id: 'gaming', name: 'gaming' }
]

export const mockDirectMessages = [
    { id: 'erik_ai', name: 'erik_ai', isAI: true }
]

export const createWelcomeMessage = (username) => {
    return {
        id: Date.now(),
        user: 'erik_ai',
        text: `Welcome ${username}!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAI: true
    }
}

export const createJoinMessage = (username) => {
    return {
        id: Date.now() + 1,
        text: `${username} entered the chat`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isSystem: true
    }
}

export const getInitialMessages = (channelId, username) => {
    const messages = {
        general: [
            {
                id: 1,
                user: 'Alex Johnson',
                text: 'Hey everyone! Great to have a secure chat platform',
                time: '10:15 AM'
            },
            {
                id: 2,
                user: 'Sarah Chen',
                text: 'Absolutely! The encryption here is top-notch',
                time: '10:16 AM'
            },
            {
                id: 3,
                user: 'Michael Brown',
                text: 'Has anyone tried the file sharing feature yet?',
                time: '10:20 AM'
            },
            createJoinMessage(username),
            {
                id: Date.now() + 2,
                user: 'erik_ai',
                text: `Welcome ${username}!`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isAI: true
            }
        ],
        random: [
            {
                id: 1,
                user: 'Emma Wilson',
                text: 'Just discovered this amazing coffee shop downtown',
                time: '9:00 PM'
            },
            {
                id: 2,
                user: 'David Martinez',
                text: 'Which one? Always looking for good coffee',
                time: '9:05 PM'
            },
            createJoinMessage(username),
            {
                id: Date.now() + 2,
                user: 'erik_ai',
                text: `Welcome ${username}!`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isAI: true
            }
        ],
        tech: [
            {
                id: 1,
                user: 'Lisa Anderson',
                text: 'New quantum encryption paper just dropped',
                time: '2:00 PM'
            },
            {
                id: 2,
                user: 'James Taylor',
                text: 'Link? That sounds fascinating',
                time: '2:01 PM'
            },
            createJoinMessage(username),
            {
                id: Date.now() + 2,
                user: 'erik_ai',
                text: `Welcome ${username}!`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isAI: true
            }
        ],
        gaming: [
            {
                id: 1,
                user: 'Ryan Cooper',
                text: 'Anyone up for some co-op tonight?',
                time: '3:00 PM'
            },
            createJoinMessage(username),
            {
                id: Date.now() + 2,
                user: 'erik_ai',
                text: `Welcome ${username}!`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isAI: true
            }
        ],
        erik_ai: []
    }

    return messages[channelId] || [createJoinMessage(username)]
}

export const getChannelName = (channelId, channels, dms) => {
    const channel = [...channels, ...dms].find(ch => ch.id === channelId)
    return channel ? channel.name : channelId
}