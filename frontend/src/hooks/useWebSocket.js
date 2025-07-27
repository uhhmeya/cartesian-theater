import { useState, useEffect, useRef } from 'react'
import { connectWebSocket } from '../services/websocket'

export const useWebSocket = (onMessage) => {
    const [connectionStatus, setConnectionStatus] = useState('connecting')
    const socketRef = useRef(null)
    const onMessageRef = useRef(onMessage)

    useEffect(() => {
        onMessageRef.current = onMessage
    }, [onMessage])

    useEffect(() => {
        const access_token = localStorage.getItem('access_token')
        if (!access_token) return

        const socket = connectWebSocket(access_token, (status, socketInstance) => {
            setConnectionStatus(status)
            if (status === 'connected' && socketInstance) {
                socketRef.current = socketInstance
                socketInstance.on('message', data => onMessageRef.current(data))
                socketInstance.on('connection_response', () => {})
            }
        })

        return () => {
            if (socket) {
                socket.removeAllListeners()
                socket.disconnect()
            }
        }
    }, [])

    const sendMessage = (text, recipient) => {
        if (socketRef.current) socketRef.current.emit('message', { text, recipient })
    }

    return { connectionStatus, sendMessage }
}
