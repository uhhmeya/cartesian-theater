export const kdfRoot = async (rootKey, dhOutput) => {
    const key = await crypto.subtle.importKey('raw',
        new Uint8Array(rootKey.match(/.{2}/g).map(byte => parseInt(byte, 16))),
        'HMAC', false, ['sign'], {name: 'HMAC', hash: 'SHA-256'})

    const ephemeralBytes = new Uint8Array(dhOutput.match(/.{2}/g).map(byte => parseInt(byte, 16)))
    const output = await crypto.subtle.sign('HMAC', key, ephemeralBytes)
    const result = new Uint8Array(output)

    return {
        rootKey: Array.from(result.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(''),
        chainKey: Array.from(result.slice(32, 64)).map(b => b.toString(16).padStart(2, '0')).join('')
    }
}