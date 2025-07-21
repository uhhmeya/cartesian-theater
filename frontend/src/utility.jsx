import { io } from 'socket.io-client'

let socket = null

export const apiRequest = async (endpoint, payload) => {
    const token = localStorage.getItem('access_token')
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    })

    const data = await response.json()
    return { success: response.ok, data }
}

export const clearTokens = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('username')
}

export const connectWebSocket = onStatusChange => {
    if (socket?.connected) {
        onStatusChange('connected', socket)
        return socket
    }

    const token = localStorage.getItem('access_token')
    if (!token) {
        onStatusChange('error', null)
        return null
    }

    socket = io(window.location.hostname === 'localhost' ? 'http://localhost:5001' : window.location.origin, {
        transports: ['websocket', 'polling'],
        query: { token }
    })

    socket.on('connect', () => onStatusChange('connected', socket))
    socket.on('disconnect', () => onStatusChange('disconnected', null))
    socket.on('connect_error', () => onStatusChange('error', null))

    return socket
}

export const handleLogout = navigate => {
    if (socket) socket.disconnect()
    socket = null
    clearTokens()
    navigate('/login')
}

