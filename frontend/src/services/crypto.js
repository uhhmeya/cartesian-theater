import { apiRequest } from './api'

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

const generateKeyPair = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey", "deriveBits"])

    const publicKey = await window.crypto.subtle.exportKey("raw", keyPair.publicKey)
    const privateKey = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey)

    return {
        public: Array.from(new Uint8Array(publicKey)).map(b => b.toString(16).padStart(2, '0')).join(''),
        private: Array.from(new Uint8Array(privateKey)).map(b => b.toString(16).padStart(2, '0')).join('')
    }
}

export const generateKeyBundle = async () => {
    const identityKeys = await generateKeyPair()
    const weeklyKeys = await generateKeyPair()
    const singleUseKeys = await Promise.all(Array.from({length: 100}, () => generateKeyPair()))
    const weeklySignature = 'temp_signature'

    localStorage.setItem('identityPrivateKey', identityKeys.private)
    localStorage.setItem('weeklyPrivateKey', weeklyKeys.private)
    singleUseKeys.forEach((key, i) =>
        localStorage.setItem(`singleUsePrivateKey_${i}`, key.private))

    return {
        identityPublic: identityKeys.public,
        weeklyPublic: weeklyKeys.public,
        singleUsePublics: singleUseKeys.map(k => k.public),
        weeklySignature
    }
}

export const performX3DH = async (recipientKeyBundle) => {
    const identityPrivate = localStorage.getItem('identityPrivateKey')
    const weeklyPrivate = localStorage.getItem('weeklyPrivateKey')

    const identityKey = await window.crypto.subtle.importKey(
        "pkcs8",
        new Uint8Array(identityPrivate.match(/.{1,2}/g).map(byte => parseInt(byte, 16))),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveBits"]
    )

    const weeklyKey = await window.crypto.subtle.importKey(
        "pkcs8",
        new Uint8Array(weeklyPrivate.match(/.{1,2}/g).map(byte => parseInt(byte, 16))),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveBits"]
    )

    const recipientIdentity = await window.crypto.subtle.importKey(
        "raw",
        new Uint8Array(recipientKeyBundle.identityPublic.match(/.{1,2}/g).map(byte => parseInt(byte, 16))),
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
    )

    const sharedBits = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: recipientIdentity },
        identityKey,
        256
    )

    return Array.from(new Uint8Array(sharedBits)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const encrypt = (text, sharedSecret) => {
    const key = new Uint8Array(sharedSecret.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
    const encoded = new TextEncoder().encode(text)
    return Array.from(encoded).map((byte, i) => byte ^ key[i % key.length]).map(b => b.toString(16).padStart(2, '0')).join('')
}




