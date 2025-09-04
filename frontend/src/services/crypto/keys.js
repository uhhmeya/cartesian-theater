import { ec as EC } from 'elliptic'

export const deriveIdentityKeyPair = async (password, username) => {
    try {
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
    } catch (error) {
        console.error('[deriveIdentityKeyPair] Error:', error)
        throw error
    }
}

export const generateKeyPair = () => {
    try {
        const ec = new EC('p256')
        const keyPair = ec.genKeyPair()
        return [keyPair.getPrivate('hex'), keyPair.getPublic('hex')]
    } catch (error) {
        console.error('[generateKeyPair] Error:', error)
        throw error
    }
}

export const getSharedSecret = (privateKeyHex, publicKeyHex) => {
    try {
        if (!privateKeyHex || !publicKeyHex) {
            console.warn('[getSharedSecret] Missing key(s) - private:', !!privateKeyHex, 'public:', !!publicKeyHex)
            return null
        }
        const ec = new EC('p256')
        const privateKey = ec.keyFromPrivate(privateKeyHex, 'hex')
        const publicKey = ec.keyFromPublic(publicKeyHex, 'hex')
        return privateKey.derive(publicKey.getPublic()).toString('hex')
    } catch (error) {
        console.error('[getSharedSecret] Error:', error)
        return null
    }
}

export const encrypt = async (text, sharedSecretHex) => {
    try {
        if (!sharedSecretHex || sharedSecretHex.length < 64) {
            throw new Error(`Invalid shared secret: length ${sharedSecretHex?.length}`)
        }

        const key = await crypto.subtle.importKey('raw',
            new Uint8Array(sharedSecretHex.match(/.{2}/g).map(byte => parseInt(byte, 16))),
            'AES-GCM', false, ['encrypt'])

        const iv = crypto.getRandomValues(new Uint8Array(12))
        const encoded = new TextEncoder().encode(text)
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

        return Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('') +
            Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
        console.error('[encrypt] Error:', error)
        throw error
    }
}

export const decrypt = async (encryptedHex, sharedSecretHex) => {
    try {
        // Validate inputs
        if (!encryptedHex || typeof encryptedHex !== 'string') {
            throw new Error('Invalid encrypted data: not a string or empty')
        }

        if (!sharedSecretHex || typeof sharedSecretHex !== 'string') {
            throw new Error('Invalid shared secret: not a string or empty')
        }

        if (!/^[0-9a-fA-F]+$/.test(encryptedHex)) {
            throw new Error('Invalid encrypted hex: contains non-hex characters')
        }

        if (!/^[0-9a-fA-F]+$/.test(sharedSecretHex)) {
            throw new Error('Invalid shared secret hex: contains non-hex characters')
        }

        if (encryptedHex.length < 48) {
            throw new Error(`Encrypted data too short: ${encryptedHex.length} hex chars`)
        }

        if (sharedSecretHex.length !== 64) { // 32 bytes = 64 hex chars
            console.error(`[decrypt] Unexpected key length: ${sharedSecretHex.length} (expected 64)`)
            console.error(`[decrypt] Key preview: ${sharedSecretHex.slice(0, 16)}...`)
        }

        // Parse the key
        const keyBytes = sharedSecretHex.match(/.{2}/g).map(byte => parseInt(byte, 16))
        if (keyBytes.some(b => isNaN(b))) {
            throw new Error('Failed to parse shared secret hex')
        }

        const key = await crypto.subtle.importKey('raw',
            new Uint8Array(keyBytes),
            'AES-GCM', false, ['decrypt'])

        // Parse IV and ciphertext
        const iv = new Uint8Array(encryptedHex.slice(0, 24).match(/.{2}/g).map(byte => parseInt(byte, 16)))
        const encrypted = new Uint8Array(encryptedHex.slice(24).match(/.{2}/g).map(byte => parseInt(byte, 16)))

        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
        return new TextDecoder().decode(decrypted)
    } catch (error) {
        console.error('[decrypt] Decryption failed:', error.message)
        console.error('[decrypt] Encrypted length:', encryptedHex?.length)
        console.error('[decrypt] Secret length:', sharedSecretHex?.length)
        console.error('[decrypt] Secret preview:', sharedSecretHex?.slice(0, 16) + '...')
        throw error
    }
}

export const signData = async (privateKeyHex, data) => {
    try {
        const ec = new EC('p256')
        const privateKey = ec.keyFromPrivate(privateKeyHex, 'hex')
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
        const hashArray = new Uint8Array(hash)
        const signature = privateKey.sign(hashArray)
        return signature.toDER('hex')
    } catch (error) {
        console.error('[signData] Error:', error)
        throw error
    }
}

export const verifySignature = async (publicKeyHex, data, signatureHex) => {
    try {
        const ec = new EC('p256')
        const publicKey = ec.keyFromPublic(publicKeyHex, 'hex')
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
        const hashArray = new Uint8Array(hash)
        return publicKey.verify(hashArray, signatureHex)
    } catch (error) {
        console.error('[verifySignature] Error:', error.message)
        throw error
    }
}

export const createSK = async (identitySecret, ephSecret, outputLength = 32) => {
    try {
        if (!identitySecret || !ephSecret) {
            throw new Error('Missing secrets for SK creation')
        }

        const identityBytes = new Uint8Array(identitySecret.match(/.{2}/g).map(byte => parseInt(byte, 16)))
        const ephBytes = new Uint8Array(ephSecret.match(/.{2}/g).map(byte => parseInt(byte, 16)))
        const combinedBytes = new Uint8Array([...identityBytes, ...ephBytes])

        const encoder = new TextEncoder()
        const salt = new Uint8Array(32)
        const info = encoder.encode('DoubleRatchet-KDF-Root')

        const key = await crypto.subtle.importKey('raw', combinedBytes, 'HKDF', false, ['deriveKey', 'deriveBits'])
        const bits = await crypto.subtle.deriveBits({
            name: 'HKDF',
            hash: 'SHA-256',
            salt: salt,
            info: info
        }, key, outputLength * 8)

        return new Uint8Array(bits)
    } catch (error) {
        console.error('[createSK] Error:', error)
        throw error
    }
}

export const kdfRoot = async (rootKey, dhOutput) => {
    try {
        if (!rootKey || !dhOutput) {
            throw new Error(`kdfRoot missing inputs - rootKey: ${!!rootKey}, dhOutput: ${!!dhOutput}`)
        }

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
    } catch (error) {
        console.error('[kdfRoot] Error:', error)
        throw error
    }
}

export const kdfChain = async (chainKey) => {
    try {
        if (!chainKey) {
            throw new Error('kdfChain: chainKey is missing')
        }

        const keyBytes = new Uint8Array(chainKey.match(/.{2}/g).map(byte => parseInt(byte, 16)))
        const key = await crypto.subtle.importKey('raw', keyBytes, {name: 'HMAC', hash: 'SHA-256'}, false, ['sign'])

        const nextChain = await crypto.subtle.sign('HMAC', key, new Uint8Array([0x02]))
        const messageKey = await crypto.subtle.sign('HMAC', key, new Uint8Array([0x01]))

        return [
            Array.from(new Uint8Array(nextChain)).map(b => b.toString(16).padStart(2, '0')).join(''),
            Array.from(new Uint8Array(messageKey)).map(b => b.toString(16).padStart(2, '0')).join('')
        ]
    } catch (error) {
        console.error('[kdfChain] Error:', error)
        throw error
    }
}

export const encryptForStorage = async (data, privateIdentityKey) => {
    try {
        const storageKey = await deriveStorageKey(privateIdentityKey)
        const dataString = typeof data === 'string' ? data : JSON.stringify(data)
        return await encrypt(dataString, storageKey)
    } catch (error) {
        console.error('[encryptForStorage] Error:', error)
        throw error
    }
}

export const decryptFromStorage = async (encryptedData, privateIdentityKey) => {
    if (!encryptedData) return null
    try {
        const storageKey = await deriveStorageKey(privateIdentityKey)
        return await decrypt(encryptedData, storageKey)
    } catch (error) {
        console.error('[decryptFromStorage] Error:', error)
        return null
    }
}

export const deriveStorageKey = async (privateIdentityKey) => {
    try {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(privateIdentityKey),
            'PBKDF2',
            false,
            ['deriveKey']
        )

        const derivedKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: new TextEncoder().encode('localStorage-encryption-salt'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            true,
            ['encrypt', 'decrypt']
        )

        const keyBuffer = await crypto.subtle.exportKey('raw', derivedKey)
        return Array.from(new Uint8Array(keyBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
        console.error('[deriveStorageKey] Error:', error)
        throw error
    }
}

