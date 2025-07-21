import io from 'socket.io-client'

export const connectWebSocket = (token, onStatusChange) => {
    const socket = io('http://localhost:5001', { query: { token }})

    socket.on('connect', () => onStatusChange('connected', socket))
    socket.on('disconnect', () => onStatusChange('disconnected'))
    socket.on('connect_error', () => onStatusChange('disconnected'))

    return socket
}