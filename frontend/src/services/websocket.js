import io from 'socket.io-client'

// global socket ref
let activeSocket = null

export const connectWebSocket = (token, onStatusChange) => {

    // checks if socket already connected, and just returns the existing socket if it does
    if (activeSocket && activeSocket.connected) {
        onStatusChange('connected', activeSocket)
        return activeSocket}

    // deletes unconnected sockets
    if (activeSocket) {
        activeSocket.disconnect()
        activeSocket = null
    }

    //creates new socket
    const socket = io('http://localhost:5001', {
        query: { token },
        reconnection: false
    })
    activeSocket = socket

    // creates listeners
    socket.on('connect', () => onStatusChange('connected', socket))

    socket.on('disconnect', () => {
        onStatusChange('disconnected')
        activeSocket = null})

    socket.on('connect_error', () => {
        onStatusChange('error')
        activeSocket = null
    })

    return socket
}