import {encryptForStorage, decryptFromStorage} from './crypto/keys.js'

export const getFromStorage = async (itemType, friends, identityKey) => {
    const loaded = {}

    for (const friend of friends) {
        const encryptedItem = localStorage.getItem(`${itemType}_${friend.username}`)
        if (!encryptedItem) continue

        const decryptedItem = await decryptFromStorage(encryptedItem, identityKey)
        if (decryptedItem) {
            loaded[friend.username] = itemType === 'ratchet_state'
                ? JSON.parse(decryptedItem)
                : decryptedItem
        }
    }
    return loaded
}

export const store = async (key, data, privateKey) => {
    const encrypted = await encryptForStorage(data, privateKey)
    localStorage.setItem(key, encrypted)
}

export const getPrekey = async (prekeyIndex, privateKey) => {
    const encrypted = localStorage.getItem(`prekey_${prekeyIndex}`)
    return encrypted ? await decryptFromStorage(encrypted, privateKey) : null
}





