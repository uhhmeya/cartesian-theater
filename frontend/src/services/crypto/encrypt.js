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