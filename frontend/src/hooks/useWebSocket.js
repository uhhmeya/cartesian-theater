import { useState, useEffect, useRef } from 'react'
import { connectWebSocket } from '../services/websocket'

export const useWebSocket = (onMessage) => {
    const [connectionStatus, setConnectionStatus] = useState('connecting')
    const socketRef = useRef(null)

    useEffect(() => {
        const access_token = localStorage.getItem('access_token')

        const socket = connectWebSocket(access_token, (status, socketInstance) => {
            setConnectionStatus(status)
            if (status === 'connected' && socketInstance) {
                socketRef.current = socketInstance
                socketInstance.on('message', onMessage)
                socketInstance.on('connection_response', data => console.log('Connected:', data))
            }
        })

        return () => socket?.disconnect()
    }, [])

    const sendMessage = (text) => {
        if (socketRef.current) socketRef.current.emit('message', { text })
    }

    return { connectionStatus, sendMessage }
}