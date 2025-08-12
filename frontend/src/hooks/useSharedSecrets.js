import { useState } from 'react'
import { apiRequest } from "../services/api.js"
import { getSharedSecret } from "../services/crypto.js"

export const useSharedSecrets = (friends, privateIdentityKey) => {
    const [sharedSecrets, setSharedSecrets] = useState({})

    const deriveAllSharedSecrets = async () => {
        const secrets = {}
        for (const friend of friends) {
            if (friend.username === 'erik') continue
            const response = await apiRequest(`/get-keys/${friend.username}`, null, 'GET')
            if (response.success)
                secrets[friend.username] = await getSharedSecret(response.data.data, privateIdentityKey)
        }
        setSharedSecrets(secrets)
    }

    return { sharedSecrets, deriveAllSharedSecrets }
}