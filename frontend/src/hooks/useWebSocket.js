import { useState, useEffect, useRef } from 'react'
import { connectWebSocket} from "../services/websocket.js";

export const useWebSocket = (handleIncomingMessage, handleStatusUpdate) => {
    const [connectionStatus, setConnectionStatus] = useState('connecting')
    const socketRef = useRef(null)
    const messageHandlerRef = useRef(handleIncomingMessage)
    const statusHandlerRef = useRef(handleStatusUpdate)

    useEffect(() => {
        messageHandlerRef.current = handleIncomingMessage
        statusHandlerRef.current = handleStatusUpdate
    }, [handleIncomingMessage, handleStatusUpdate])

    useEffect(() => {
        const access_token = localStorage.getItem('access_token')
        if (!access_token) return

        const socket = connectWebSocket(access_token, (status, socketInstance) => {
            setConnectionStatus(status)
            if (status === 'connected' && socketInstance) {
                socketRef.current = socketInstance

                socketInstance.on('message', data => messageHandlerRef.current(data))
                socketInstance.on('status_update', data => statusHandlerRef.current?.(data))

                socketInstance.on('error', data => {
                    console.error('Backend error:', data)
                })

                socketInstance.on('connect_error', error => {
                    console.error('Connection failed:', error)
                })
            }
        })

        return () => {
            if (socket) {
                socket.removeAllListeners()
                socket.disconnect()
            }
        }
    }, [])

    const sendMessage = (text, recipient, id) => {
        if (socketRef.current) socketRef.current.emit('message', { text, recipient, id })
    }

    return { connectionStatus, sendMessage, socket: socketRef.current }
}