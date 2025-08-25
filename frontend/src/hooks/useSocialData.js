import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiRequest } from '../services/api'

export const useSocialData = () => {
    const [allUsers, setAllUsers] = useState([])

    const refresh = useCallback(async () => {
        const response = await apiRequest('/social-data', null, 'GET')
        if (response.success) {
            setAllUsers(response.data.users)
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    // Memoize these so they only change when allUsers actually changes
    const friends = useMemo(() =>
        allUsers.filter(u => u.relationshipStatus === 'we_are_friends'), [allUsers])

    const outgoingRequests = useMemo(() =>
        allUsers.filter(u => u.relationshipStatus === 'i_sent_them_a_request'), [allUsers])

    const incomingRequests = useMemo(() =>
        allUsers.filter(u => u.relationshipStatus === 'they_sent_me_a_request'), [allUsers])

    const sendFriendRequest = useCallback(async (userId) => {
        const response = await apiRequest('/friend-request', { receiver_id: userId })
        if (response.success) await refresh()
        return response
    }, [refresh])

    const acceptRequest = useCallback(async (requestId) => {
        const response = await apiRequest(`/friend-request/${requestId}/accept`, null, 'POST')
        if (response.success) await refresh()
        return response
    }, [refresh])

    const rejectRequest = useCallback(async (requestId) => {
        const response = await apiRequest(`/friend-request/${requestId}/reject`, null, 'POST')
        if (response.success) await refresh()
        return response
    }, [refresh])

    const withdrawRequest = useCallback(async (requestId) => {
        const response = await apiRequest(`/friend-request/${requestId}/cancel`, null, 'DELETE')
        if (response.success) await refresh()
        return response
    }, [refresh])

    return {
        allUsers,
        friends,
        outgoingRequests,
        incomingRequests,
        refresh,
        sendFriendRequest,
        acceptRequest,
        rejectRequest,
        withdrawRequest
    }
}