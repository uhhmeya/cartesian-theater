import { apiRequest } from './api'
import { ec as EC } from 'elliptic'

export const loadConversationHistory = async (username) => {
    if (username === 'erik') return []
    const response = await apiRequest(`/conversation/${username}`, null, 'GET')
    return response.success ? response.data.messages : []
}

export const shouldScrollToBottom = (lastMessage, myUsername, activeFriend) => {
    if (!lastMessage || !activeFriend) return false
    return (lastMessage.sender === myUsername && lastMessage.receiver === activeFriend.username) ||
        (lastMessage.sender === activeFriend.username && lastMessage.receiver === myUsername)
}

export const getSharedSecret = async (recipientKeyBundle, myPrivateKey) => {
    const ec = new EC('p256')
    const myKey = ec.keyFromPrivate(myPrivateKey, 'hex')
    const theirKey = ec.keyFromPublic(recipientKeyBundle.identityPublic, 'hex')
    const sharedSecret = myKey.derive(theirKey.getPublic())
    return sharedSecret.toString('hex')
}

export const encrypt = (text, sharedSecret) => {
    const key = new Uint8Array(sharedSecret.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
    const encoded = new TextEncoder().encode(text)
    return Array.from(encoded).map((byte, i) => byte ^ key[i % key.length]).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const decrypt = (encryptedText, sharedSecret) => {
    const key = new Uint8Array(sharedSecret.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
    const encrypted = new Uint8Array(encryptedText.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
    const decrypted = encrypted.map((byte, i) => byte ^ key[i % key.length])
    return new TextDecoder().decode(decrypted)
}

export const decryptConversationHistory = (history, sharedSecrets, activeFriend) => {
    return history.map(msg => {
        const secret = sharedSecrets[activeFriend.username]
        if (secret) return {...msg, text: decrypt(msg.text, secret)}
        return msg
    })
}



export const deriveKeysFromPassword = async (password, username) => {
    const ec = new EC('p256')

    const deriveBytes = async (info) => {
        const keyMaterial = await crypto.subtle.importKey('raw',
            new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])

        const derivedKey = await crypto.subtle.deriveKey({
            name: 'PBKDF2',
            salt: new TextEncoder().encode(username + info),
            iterations: 100000,
            hash: 'SHA-256'
        }, keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt'])

        return await crypto.subtle.exportKey('raw', derivedKey)
    }

    const createKeyPair = async (info) => {
        const keyBytes = await deriveBytes(info)
        const keyPair = ec.keyFromPrivate(new Uint8Array(keyBytes))
        return {
            privateKey: keyPair.getPrivate('hex'),
            publicKey: keyPair.getPublic('hex')
        }
    }

    const identityPair = await createKeyPair('identity')
    const weeklyPair = await createKeyPair('weekly')

    const singleUsePairs = []
    for (let i = 0; i < 100; i++)
        singleUsePairs.push(await createKeyPair(`single_${i}`))

    return {
        privateKeys: {
            identity: identityPair.privateKey,
            weekly: weeklyPair.privateKey,
            singleUse: singleUsePairs.map(pair => pair.privateKey)
        },
        publicKeys: {
            identityPublic: identityPair.publicKey,
            weeklyPublic: weeklyPair.publicKey,
            singleUsePublics: singleUsePairs.map(pair => pair.publicKey),
            weeklySignature: ec.keyFromPrivate(identityPair.privateKey, 'hex')
                .sign(weeklyPair.publicKey).toDER('hex')
        }
    }
}