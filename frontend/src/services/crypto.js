import { ec as EC } from 'elliptic'

export const deriveIdentityKeyPair = async (password, username) => {
    const saltString = `identity_key_v1_${username}_${password.length}`
    const salt = new TextEncoder().encode(saltString)

    const keyMaterial = await crypto.subtle.importKey('raw',
        new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])

    const derivedKey = await crypto.subtle.deriveKey({
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
    }, keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt'])

    const keyBytes = await crypto.subtle.exportKey('raw', derivedKey)
    const ec = new EC('p256')
    const keyPair = ec.keyFromPrivate(new Uint8Array(keyBytes))

    return {
        privateKey: keyPair.getPrivate('hex'),
        publicKey: keyPair.getPublic('hex')}
}

export const getSharedSecret = (privateKeyHex, publicKeyHex) => {

    if (!privateKeyHex) {
        console.error('Private key is null/undefined')
        return null
    }
    if (!publicKeyHex) {
        console.error('Public key is null/undefined')
        return null
    }

    const ec = new EC('p256')
    const privateKey = ec.keyFromPrivate(privateKeyHex, 'hex')
    const publicKey = ec.keyFromPublic(publicKeyHex, 'hex')
    return privateKey.derive(publicKey.getPublic()).toString('hex')
}

