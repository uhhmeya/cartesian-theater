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