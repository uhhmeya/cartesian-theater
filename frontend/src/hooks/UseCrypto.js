
import { useState, useEffect } from 'react'
import { getFromStorage, store } from '../services/storage'
import { getSharedSecret } from '../services/crypto/keys.js'
import { apiRequest } from '../services/api'
import {computeAndStoreSK} from "../services/crypto/skUtils.js";

export function useCrypto(friends, myIdentityPrivKey, activeFriend) {
    const [states, setStates] = useState({})
    const [identitySecrets, setIdentitySecrets] = useState({})
    const [pubIdentityKeys, setPubIdentityKeys] = useState({})
    const [SKs, setSKs] = useState({})

    // get secrets
    useEffect(() => {
        if (!friends.length || !myIdentityPrivKey) return

        (async () => {
            const existingSecrets = await getFromStorage('identity_secret', friends, myIdentityPrivKey)
            const existingPubKeys = await getFromStorage('public_identity_key', friends, myIdentityPrivKey)

            if (Object.keys(existingSecrets).length > 0) setIdentitySecrets(prev => ({ ...prev, ...existingSecrets }))
            if (Object.keys(existingPubKeys).length > 0) setPubIdentityKeys(prev => ({ ...prev, ...existingPubKeys }))

            const friendsNeedingSecrets = friends.filter(f => f.username !== 'erik' && !existingSecrets[f.username])

            for (const friend of friendsNeedingSecrets) {
                try {
                    const response = await apiRequest(`/get-identity-key/${friend.username}`, null, 'GET')
                    const theirPublicKey = response.data.data.identityPublic
                    const secret = getSharedSecret(myIdentityPrivKey, theirPublicKey)

                    await store(`identity_secret_${friend.username}`, secret, myIdentityPrivKey)
                    setIdentitySecrets(prev => ({ ...prev, [friend.username]: secret }))

                    await store(`public_identity_key_${friend.username}`, theirPublicKey, myIdentityPrivKey)
                    setPubIdentityKeys(prev => ({ ...prev, [friend.username]: theirPublicKey }))

                } catch (error) {
                    console.error(`Error getting secret for ${friend.username}:`, error)
                }
            }
        })()
    }, [friends, myIdentityPrivKey])

    // get states
    useEffect(() => {
        if (!myIdentityPrivKey) return;
        (async () => {
            const loadedStates = await getFromStorage('ratchet_state', friends, myIdentityPrivKey);
            if (Object.keys(loadedStates).length > 0) {
                setStates(prev => ({ ...prev, ...loadedStates }));
            }
        })();
    }, [friends, myIdentityPrivKey]);

    // get SKs
    useEffect(() => {
        if (!friends.length || !myIdentityPrivKey) return

        (async () => {
            const existingSKs = await getFromStorage('SK', friends, myIdentityPrivKey)
            if (Object.keys(existingSKs).length > 0)
                setSKs(prev => ({ ...prev, ...existingSKs }))
        })()
    }, [friends, myIdentityPrivKey])

    // new active friend :
    useEffect(() => {
        if (!activeFriend || activeFriend.username === 'erik' || SKs[activeFriend.username]) return

        (async () => {
            await computeAndStoreSK(activeFriend.username, identitySecrets, pubIdentityKeys, myIdentityPrivKey, setSKs)})()
    }, [activeFriend, identitySecrets, pubIdentityKeys, myIdentityPrivKey, SKs])

    return {
        states,
        setStates,
        identitySecrets,
        setIdentitySecrets,
        pubIdentityKeys,
        setPubIdentityKeys,
        SKs,
        setSKs
    }
}