import {generateKeyPair, getSharedSecret, verifySignature, createSK, kdfRoot, kdfChain} from './keys.js'
import {apiRequest} from '../api.js'

export class State {
    constructor() {
        this.my_RatchetKeyPair = null
        this.other_RatchetPubKey = null
        this.Rootkey = null
        this.sending_ChainKey = null
        this.recieving_ChainKey = null
        this.messagesSent = 0
        this.messagesReceived = 0
        this.prevChainLength = 0
        this.skippedMessageKeys = {}
        this.usedPrekeyIndex = null
    }
}

export const getAllSharedSecrets = async (myIdentityPrivKey, friends, connectionStatus) => {
    if (!friends.length || connectionStatus !== 'connected') return { identitySecrets: {}, pubIdentityKeys: {} }

    const identitySecrets = {}
    const pubIdentityKeys = {}

    for (const friend of friends) {
        if (friend.username === 'erik') continue

        const response = await apiRequest(`/get-identity-key/${friend.username}`, null, 'GET')
        if (!response.success) continue

        const ameyaIdentityKey = response.data.data.identityPublic
        console.log(`Public Identity key retrieved for ${friend.username}:`, ameyaIdentityKey?.slice(0, 16) + '...')
        pubIdentityKeys[friend.username] = ameyaIdentityKey

        const secret = getSharedSecret(myIdentityPrivKey, ameyaIdentityKey)
        console.log(`✓ Identity secret derived for ${friend.username}:`, secret.slice(0, 16) + '...')
        identitySecrets[friend.username] = secret
    }

    return { identitySecrets, pubIdentityKeys }
}

export const initiatorEphExchange = async (friendUsername, identitySecret, otherPublicIdentityKey) => {

    const [initiator_EphPriv, initiator_EphPub] = generateKeyPair()

    const ephSecret = getSharedSecret(initiator_EphPriv, otherPublicIdentityKey)

    console.log(`Eph secret derived (initiator) for ${friendUsername}:`, ephSecret.slice(0, 16) + '...')

    const SK = await createSK(identitySecret, ephSecret)
    console.log(`SK derived for ${friendUsername}:`, Array.from(SK.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('') + '...')

    await apiRequest('/initiate-rootkey', {friendUsername: friendUsername, ephemeralPublic: initiator_EphPub})

    return Array.from(SK).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const receiverEphExchange = async (friendUsername, identitySecret, myIdentityPrivKey, initiator_EphPub) => {
    const ephSecret = getSharedSecret(myIdentityPrivKey, initiator_EphPub)
    console.log(`Eph secret derived (receiver) for ${friendUsername}:`, ephSecret.slice(0, 16) + '...')

    const SK = await createSK(identitySecret, ephSecret)
    console.log(`SK derived for ${friendUsername}:`, Array.from(SK.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('') + '...')

    return Array.from(SK).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const initRatchetAlice = async (friendUsername, otherPublicIdentityKey, SK) => {
    const other_RatchetPub = await apiRequest(`/get-prekey/${friendUsername}`, null, 'GET')
    console.log('Prekey API response:', other_RatchetPub)
    console.log('Public key from API:', other_RatchetPub.data?.publicKey)
    console.log('Full API response data:', JSON.stringify(other_RatchetPub.data, null, 2))

    const state = new State()
    const [my_RatchetPriv, my_RatchetPub] = generateKeyPair()
    console.log('Generated my_RatchetPriv:', my_RatchetPriv)

    state.my_RatchetKeyPair = { private: my_RatchetPriv, public: my_RatchetPub }

    state.other_RatchetPubKey = other_RatchetPub.data.data.publicKey
    state.usedPrekeyIndex = other_RatchetPub.data.data.prekeyIndex
    const dhOutput = getSharedSecret(my_RatchetPriv, other_RatchetPub.data.data.publicKey)

    console.log(`[initialize state ${friendUsername}] DH Output: ${dhOutput.slice(0, 16)}...`)

    // DH ratchet
    const [newRootKey, sendingChainKey] = await kdfRoot(SK, dhOutput)
    state.Rootkey = newRootKey
    state.sending_ChainKey = sendingChainKey
    console.log(`[initialize state ${friendUsername}] Root Key: ${newRootKey.slice(0, 16)}...`)
    console.log(`[initialize state ${friendUsername}] Sending Chain Key: ${sendingChainKey.slice(0, 16)}...`)

    return state
}

export const initRatchetBob = async (friendUsername, SK, myPrekeyPrivate, aliceRatchetPublic) => {
    const state = new State()

    const dhOutput = getSharedSecret(myPrekeyPrivate, aliceRatchetPublic)
    console.log(`[initialize state ${friendUsername}] DH Output: ${dhOutput.slice(0, 16)}...`)

    // DH ratchet for receiving chain
    const [newRootKey1, receivingChainKey] = await kdfRoot(SK, dhOutput)
    state.Rootkey = newRootKey1
    state.recieving_ChainKey = receivingChainKey
    console.log(`[initialize state ${friendUsername}] Root Key: ${newRootKey1.slice(0, 16)}...`)
    console.log(`[initialize state ${friendUsername}] Receiving Chain Key: ${receivingChainKey.slice(0, 16)}...`)


    const [my_RatchetPriv, my_RatchetPub] = generateKeyPair()
    state.my_RatchetKeyPair = { private: my_RatchetPriv, public: my_RatchetPub }
    state.other_RatchetPubKey = aliceRatchetPublic

    // DH ratchet for sending chain
    const dhOutput2 = getSharedSecret(my_RatchetPriv, aliceRatchetPublic)
    const [newSendingRootkey, sendingChainKey] = await kdfRoot(state.Rootkey, dhOutput2)
    state.Rootkey = newSendingRootkey
    state.sending_ChainKey = sendingChainKey
    console.log(`[initialize state ${friendUsername}] Updated Root Key: ${newSendingRootkey.slice(0, 16)}...`)
    console.log(`[initialize state ${friendUsername}] Sending Chain Key: ${sendingChainKey.slice(0, 16)}...`)

    return state
}

export const performReceivingChainRatchet = async (state) => {
    const [newReceivingChainKey, messageKey] = await kdfChain(state.recieving_ChainKey)
    state.recieving_ChainKey = newReceivingChainKey
    state.messagesReceived++
    return messageKey
}

export const performSendingChainRatchet = async (state) => {
    const [newSendingChainKey, messageKey] = await kdfChain(state.sending_ChainKey)
    state.sending_ChainKey = newSendingChainKey
    state.messagesSent++
    return messageKey
}


export const performReceivingDHRatchet = async (state, newRatchetPubKey, sender) => {
    console.log(`[DH Ratchet ${sender}] New ratchet public key detected`)
    const dhOutput1 = getSharedSecret(state.my_RatchetKeyPair.private, newRatchetPubKey)

    // Receiving DH Ratchet
    const [newRootKey1, newReceivingChainKey] = await kdfRoot(state.Rootkey, dhOutput1)

    const [newRatchetPriv, newRatchetPub] = generateKeyPair()
    state.my_RatchetKeyPair = { private: newRatchetPriv, public: newRatchetPub }

    // Sending DH Ratchet
    const dhOutput2 = getSharedSecret(newRatchetPriv, newRatchetPubKey)
    const [newRootKey2, newSendingChainKey] = await kdfRoot(newRootKey1, dhOutput2)

    state.Rootkey = newRootKey2
    state.recieving_ChainKey = newReceivingChainKey
    state.sending_ChainKey = newSendingChainKey
    state.other_RatchetPubKey = newRatchetPubKey
    state.prevChainLength = state.messagesSent
    state.messagesSent = 0
    state.messagesReceived = 0

    console.log(`[DH Ratchet ${sender}] Updated Root Key: ${newRootKey2.slice(0, 16)}...`)
    console.log(`[DH Ratchet ${sender}] New Receiving Chain Key: ${newReceivingChainKey.slice(0, 16)}...`)
    console.log(`[DH Ratchet ${sender}] New Sending Chain Key: ${newSendingChainKey.slice(0, 16)}...`)
}