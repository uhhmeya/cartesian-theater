import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiRequest } from '../services/api'

export const useSocialData = () => {
    const [allUsers, setAllUsers] = useState([])

    const refresh = useCallback(async () => {
        const response = await apiRequest('/social-data', null, 'GET')
        if (response.success) {

            setAllUsers(prevUsers => {
                const newUsers = response.data.users


                if (prevUsers.length !== newUsers.length) {
                    console.log('Social data changed: user count')
                    return newUsers
                }

                const hasChanged = prevUsers.some((prevUser, index) => {
                    const newUser = newUsers[index]
                    return prevUser.id !== newUser.id ||
                        prevUser.relationshipStatus !== newUser.relationshipStatus ||
                        prevUser.isOnline !== newUser.isOnline ||
                        prevUser.username !== newUser.username
                })

                if (hasChanged) {
                    return newUsers
                } else {
                    return prevUsers
                }
            })
        }
    }, [])

    useEffect(() => {
        refresh()
        const interval = setInterval(refresh, 30000)
        return () => clearInterval(interval)
    }, [refresh])

    const friends = useMemo(() =>
            allUsers.filter(u => u.relationshipStatus === 'we_are_friends'),
        [allUsers])

    const onlineFriends = useMemo(() =>
        friends.filter(f => f.isOnline), [friends])

    const offlineFriends = useMemo(() =>
        friends.filter(f => !f.isOnline), [friends])

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
        onlineFriends,
        offlineFriends,
        outgoingRequests,
        incomingRequests,
        refresh,
        sendFriendRequest,
        acceptRequest,
        rejectRequest,
        withdrawRequest,
    }
}