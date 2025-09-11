import { useState, useEffect, useRef } from 'react'
import { connectWebSocket} from "../services/websocket.js";

export const useWebSocket = (handleIncomingMessage, handleStatusUpdate, handleSocialUpdate) => {
    const [connectionStatus, setConnectionStatus] = useState('connecting')
    const socketRef = useRef(null)
    const messageHandlerRef = useRef(handleIncomingMessage)
    const statusHandlerRef = useRef(handleStatusUpdate)
    const socialHandlerRef = useRef(handleSocialUpdate)

    useEffect(() => {
        messageHandlerRef.current = handleIncomingMessage
        statusHandlerRef.current = handleStatusUpdate
        socialHandlerRef.current = handleSocialUpdate
    }, [handleIncomingMessage, handleStatusUpdate, handleSocialUpdate])

    useEffect(() => {
        const access_token = localStorage.getItem('access_token')
        if (!access_token) return

        const socket = connectWebSocket(access_token, (status, socketInstance) => {
            setConnectionStatus(status)
            if (status === 'connected' && socketInstance) {
                console.log(`[${new Date().toISOString()}] WebSocket connected`)
                socketRef.current = socketInstance

                socketInstance.removeAllListeners('message')
                socketInstance.removeAllListeners('status_update')
                socketInstance.removeAllListeners('error')
                socketInstance.removeAllListeners('connect_error')
                socketInstance.removeAllListeners('social_update')

                socketInstance.on('message', data => {
                    messageHandlerRef.current(data)
                })

                socketInstance.on('status_update', data => {
                    if (statusHandlerRef.current) {
                        statusHandlerRef.current(data)
                    } else {
                    }
                })

                socketInstance.on('error', data => {
                    console.error('Backend error:', data)
                })

                socketInstance.on('connect_error', error => {
                    console.error('Connection failed:', error)
                })

                socketInstance.on('social_update', () => {
                    socialHandlerRef.current?.()
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