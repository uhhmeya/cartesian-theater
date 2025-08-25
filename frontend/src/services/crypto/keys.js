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
        publicKey: keyPair.getPublic('hex')
    }
}

export const generateKeyPair = () => {
    const ec = new EC('p256')
    const keyPair = ec.genKeyPair()
    return [keyPair.getPrivate('hex'), keyPair.getPublic('hex')]
}

export const getSharedSecret = (privateKeyHex, publicKeyHex) => {
    if (!privateKeyHex || !publicKeyHex) return null
    const ec = new EC('p256')
    const privateKey = ec.keyFromPrivate(privateKeyHex, 'hex')
    const publicKey = ec.keyFromPublic(publicKeyHex, 'hex')
    return privateKey.derive(publicKey.getPublic()).toString('hex')
}

export const encrypt = async (text, sharedSecretHex) => {
    const key = await crypto.subtle.importKey('raw',
        new Uint8Array(sharedSecretHex.match(/.{2}/g).map(byte => parseInt(byte, 16))),
        'AES-GCM', false, ['encrypt'])

    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(text)
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

    return Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('') +
        Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const decrypt = async (encryptedHex, sharedSecretHex) => {
    const key = await crypto.subtle.importKey('raw',
        new Uint8Array(sharedSecretHex.match(/.{2}/g).map(byte => parseInt(byte, 16))),
        'AES-GCM', false, ['decrypt'])

    const iv = new Uint8Array(encryptedHex.slice(0, 24).match(/.{2}/g).map(byte => parseInt(byte, 16)))
    const encrypted = new Uint8Array(encryptedHex.slice(24).match(/.{2}/g).map(byte => parseInt(byte, 16)))

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
    return new TextDecoder().decode(decrypted)
}

export const signData = async (privateKeyHex, data) => {
    const ec = new EC('p256')
    const privateKey = ec.keyFromPrivate(privateKeyHex, 'hex')
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
    const hashArray = new Uint8Array(hash)
    const signature = privateKey.sign(hashArray)
    return signature.toDER('hex')
}

export const verifySignature = async (publicKeyHex, data, signatureHex) => {
    const ec = new EC('p256')
    const publicKey = ec.keyFromPublic(publicKeyHex, 'hex')
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
    const hashArray = new Uint8Array(hash)

    try {
        return publicKey.verify(hashArray, signatureHex)
    } catch (error) {
        console.log(`[signature debug] Verification error:`, error.message)
        console.log(`[signature debug] Signature input:`, signatureHex)
        throw error
    }
}

export const createSK = (identitySecret, ephSecret, outputLength = 32) => {
    const identityBytes = new Uint8Array(identitySecret.match(/.{2}/g).map(byte => parseInt(byte, 16)))
    const ephBytes = new Uint8Array(ephSecret.match(/.{2}/g).map(byte => parseInt(byte, 16)))
    const combinedBytes = new Uint8Array([...identityBytes, ...ephBytes])

    const encoder = new TextEncoder()
    const salt = new Uint8Array(32)
    const info = encoder.encode('DoubleRatchet-KDF-Root')

    return crypto.subtle.importKey('raw', combinedBytes, 'HKDF', false, ['deriveKey', 'deriveBits'])
        .then(key => crypto.subtle.deriveBits({
            name: 'HKDF',
            hash: 'SHA-256',
            salt: salt,
            info: info
        }, key, outputLength * 8))
        .then(bits => new Uint8Array(bits))
}

export const kdfRoot = async (rootKey, dhOutput) => {
    const rootKeyBytes = new Uint8Array(rootKey.match(/.{2}/g).map(byte => parseInt(byte, 16)))
    const dhBytes = new Uint8Array(dhOutput.match(/.{2}/g).map(byte => parseInt(byte, 16)))

    const key = await crypto.subtle.importKey('raw', dhBytes, 'HKDF', false, ['deriveBits'])
    const derived = await crypto.subtle.deriveBits({
        name: 'HKDF',
        hash: 'SHA-256',
        salt: rootKeyBytes,
        info: new TextEncoder().encode('DoubleRatchet-Root')
    }, key, 512)

    const bytes = new Uint8Array(derived)
    return [
        Array.from(bytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(''),
        Array.from(bytes.slice(32, 64)).map(b => b.toString(16).padStart(2, '0')).join('')
    ]
}

export const kdfChain = async (chainKey) => {
    const keyBytes = new Uint8Array(chainKey.match(/.{2}/g).map(byte => parseInt(byte, 16)))
    const key = await crypto.subtle.importKey('raw', keyBytes, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign'])

    const nextChain = await crypto.subtle.sign('HMAC', key, new Uint8Array([0x02]))
    const messageKey = await crypto.subtle.sign('HMAC', key, new Uint8Array([0x01]))

    return [
        Array.from(new Uint8Array(nextChain)).map(b => b.toString(16).padStart(2, '0')).join(''),
        Array.from(new Uint8Array(messageKey)).map(b => b.toString(16).padStart(2, '0')).join('')
    ]
}