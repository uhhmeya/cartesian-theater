import { apiRequest } from '../api'
import { store } from '../storage'
import { initiatorEphExchange, receiverEphExchange } from './ratchet.js'

export async function computeAndStoreSK(
    friendUsername,
    identitySecrets,
    pubIdentityKeys,
    myIdentityPrivKey,
    setSKs
) {
    try {
        const response = await apiRequest('/get-root-role', {friendUsername})
        let SK

        if (response.data.data.role === 'initiator') {
            SK = await initiatorEphExchange(
                friendUsername,
                identitySecrets[friendUsername],
                pubIdentityKeys[friendUsername]
            )
        } else {
            const initiator_EphPub = response.data.data.ephemeralPublic
            SK = await receiverEphExchange(
                friendUsername,
                identitySecrets[friendUsername],
                myIdentityPrivKey,
                initiator_EphPub
            )
        }

        setSKs(prev => ({...prev, [friendUsername]: SK}))
        await store(`SK_${friendUsername}`, SK, myIdentityPrivKey)

        return SK
    } catch (error) {
        console.error(`Error computing SK for ${friendUsername}:`, error)
        throw error
    }
}