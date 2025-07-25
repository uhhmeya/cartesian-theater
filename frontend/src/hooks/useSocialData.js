import { useState, useEffect } from 'react'
import { apiRequest } from '../services/api'

export const useSocialData = () => {
    const [allUsers, setAllUsers] = useState([])

    const refresh = async () => {
        const response = await apiRequest('/api/social-data', null, 'GET')
        if (response.success) setAllUsers(response.data.users)
    }

    useEffect(() => {
        refresh()
    }, [])

    const friends = allUsers.filter(u => u.status === 'accepted')
    const outgoingRequests = allUsers.filter(u => u.status === 'pending' && u.requestType === 'sent')
    const incomingRequests = allUsers.filter(u => u.status === 'pending' && u.requestType === 'received')

    const sendFriendRequest = async (userId) => {
        const response = await apiRequest('/api/friend-request', { receiver_id: userId })
        if (response.success) refresh()
        return response
    }

    const acceptRequest = async (requestId) => {
        const response = await apiRequest(`/api/friend-request/${requestId}/accept`, null, 'POST')
        if (response.success) refresh()
        return response
    }

    const rejectRequest = async (requestId) => {
        const response = await apiRequest(`/api/friend-request/${requestId}/reject`, null, 'POST')
        if (response.success) refresh()
        return response
    }

    const cancelRequest = async (requestId) => {
        const response = await apiRequest(`/api/friend-request/${requestId}/cancel`, null, 'DELETE')
        if (response.success) refresh()
        return response
    }

    return {
        allUsers,
        friends,
        outgoingRequests,
        incomingRequests,
        refresh,
        sendFriendRequest,
        acceptRequest,
        rejectRequest,
        cancelRequest
    }
}