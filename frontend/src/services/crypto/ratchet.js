import {generateKeyPair, getSharedSecret, createSK, kdfRoot, kdfChain} from './keys.js'
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

export const initiatorEphExchange = async (friendUsername, identitySecret, otherPublicIdentityKey) => {
    try {
        if (!identitySecret) throw new Error('Identity secret is missing')
        if (!otherPublicIdentityKey) throw new Error('Other public identity key is missing')

        const [initiator_EphPriv, initiator_EphPub] = generateKeyPair()
        const ephSecret = getSharedSecret(initiator_EphPriv, otherPublicIdentityKey)
        console.log(`EPHEMERAL SECRET (initiator) for ${friendUsername}:`, ephSecret)


        if (!ephSecret) throw new Error('Failed to derive ephemeral secret')

        const SK = await createSK(identitySecret, ephSecret)
        const SKHex = Array.from(SK).map(b => b.toString(16).padStart(2, '0')).join('')
        console.log(`SK (initiator) for ${friendUsername}:`, SKHex)

        const response = await apiRequest('/initiate-rootkey', {friendUsername: friendUsername, ephemeralPublic: initiator_EphPub})
        if (!response.success) throw new Error('Failed to initiate root key on server')

        return Array.from(SK).map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
        console.error(`[initiatorEphExchange] Error for ${friendUsername}:`, error.message)
        throw error
    }
}

export const receiverEphExchange = async (friendUsername, identitySecret, myIdentityPrivKey, initiator_EphPub) => {
    try {
        if (!identitySecret) throw new Error('Identity secret is missing')
        if (!myIdentityPrivKey) throw new Error('My identity private key is missing')
        if (!initiator_EphPub) throw new Error('Initiator ephemeral public key is missing')

        const ephSecret = getSharedSecret(myIdentityPrivKey, initiator_EphPub)
        console.log(`EPHEMERAL SECRET (receiver) for ${friendUsername}:`, ephSecret)

        if (!ephSecret) throw new Error('Failed to derive ephemeral secret')

        const SK = await createSK(identitySecret, ephSecret)
        const SKHex = Array.from(SK).map(b => b.toString(16).padStart(2, '0')).join('')
        console.log(`SK (receiver) for ${friendUsername}:`, SKHex)

        return Array.from(SK).map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
        console.error(`[receiverEphExchange] Error for ${friendUsername}:`, error.message)
        throw error
    }
}

export const initRatchetAlice = async (friendUsername, otherPublicIdentityKey, SK) => {
    try {
        if (!SK) throw new Error('SK is missing - ephemeral exchange may have failed')

        const other_RatchetPub = await apiRequest(`/get-prekey/${friendUsername}`, null, 'GET')

        if (!other_RatchetPub?.data?.data?.publicKey) {
            console.error('[initRatchetAlice] Invalid prekey response:', other_RatchetPub)
            throw new Error('Invalid prekey response from server')
        }

        const state = new State()
        const [my_RatchetPriv, my_RatchetPub] = generateKeyPair()

        state.my_RatchetKeyPair = { private: my_RatchetPriv, public: my_RatchetPub }
        state.other_RatchetPubKey = other_RatchetPub.data.data.publicKey
        state.usedPrekeyIndex = other_RatchetPub.data.data.prekeyIndex

        const dhOutput = getSharedSecret(my_RatchetPriv, other_RatchetPub.data.data.publicKey)
        if (!dhOutput) throw new Error('Failed to compute DH output')



        const [newRootKey, sendingChainKey] = await kdfRoot(SK, dhOutput)
        console.log(`🌳 ROOT KEY (Alice) for ${friendUsername}:`, newRootKey)
        console.log(`⛓️ INITIAL SENDING CHAIN KEY (Alice):`, sendingChainKey)
        state.Rootkey = newRootKey
        state.sending_ChainKey = sendingChainKey

        return state
    } catch (error) {
        console.error(`[initRatchetAlice] Error for ${friendUsername}:`, error.message)
        throw error
    }
}

export const initRatchetBob = async (friendUsername, SK, myPrekeyPrivate, aliceRatchetPublic) => {
    try {
        if (!SK) throw new Error('SK is missing')
        if (!myPrekeyPrivate) throw new Error('My prekey private is missing')
        if (!aliceRatchetPublic) throw new Error('Alice ratchet public key is missing')

        const state = new State()

        const dhOutput = getSharedSecret(myPrekeyPrivate, aliceRatchetPublic)
        if (!dhOutput) throw new Error('Failed to compute initial DH output')

        const [newRootKey1, receivingChainKey] = await kdfRoot(SK, dhOutput)
        console.log(`🌳 ROOT KEY 1 (Bob) for ${friendUsername}:`, newRootKey1)
        console.log(`⛓️ INITIAL RECEIVING CHAIN KEY (Bob):`, receivingChainKey)
        state.Rootkey = newRootKey1
        state.recieving_ChainKey = receivingChainKey

        const [my_RatchetPriv, my_RatchetPub] = generateKeyPair()
        state.my_RatchetKeyPair = { private: my_RatchetPriv, public: my_RatchetPub }
        state.other_RatchetPubKey = aliceRatchetPublic

        const dhOutput2 = getSharedSecret(my_RatchetPriv, aliceRatchetPublic)
        if (!dhOutput2) throw new Error('Failed to compute second DH output')

        const [newSendingRootkey, sendingChainKey] = await kdfRoot(state.Rootkey, dhOutput2)
        state.Rootkey = newSendingRootkey
        state.sending_ChainKey = sendingChainKey

        return state
    } catch (error) {
        console.error(`[initRatchetBob] Error for ${friendUsername}:`, error.message)
        throw error
    }
}

export const performReceivingChainRatchet = async (state) => {
    try {
        if (!state.recieving_ChainKey) {
            throw new Error('Receiving chain key is missing from state')
        }

        const [newReceivingChainKey, messageKey] = await kdfChain(state.recieving_ChainKey)
        console.log(`📥 RECEIVING MESSAGE KEY #${state.messagesReceived + 1}:`, messageKey)
        state.recieving_ChainKey = newReceivingChainKey
        state.messagesReceived++
        return messageKey
    } catch (error) {
        console.error('[performReceivingChainRatchet] Error:', error.message)
        throw error
    }
}

export const performSendingChainRatchet = async (state) => {
    try {
        if (!state.sending_ChainKey) {
            throw new Error('Sending chain key is missing from state')
        }

        const [newSendingChainKey, messageKey] = await kdfChain(state.sending_ChainKey)
        console.log(`📤 SENDING MESSAGE KEY #${state.messagesSent + 1}:`, messageKey)
        state.sending_ChainKey = newSendingChainKey
        state.messagesSent++
        return messageKey
    } catch (error) {
        console.error('[performSendingChainRatchet] Error:', error.message)
        throw error
    }
}

export const performReceivingDHRatchet = async (state, newRatchetPubKey, sender) => {
    try {

        if (!state.my_RatchetKeyPair?.private) {
            throw new Error('My ratchet private key is missing from state')
        }

        const dhOutput1 = getSharedSecret(state.my_RatchetKeyPair.private, newRatchetPubKey)
        if (!dhOutput1) throw new Error('Failed to compute DH output 1')

        const [newRootKey1, newReceivingChainKey] = await kdfRoot(state.Rootkey, dhOutput1)

        const [newRatchetPriv, newRatchetPub] = generateKeyPair()
        state.my_RatchetKeyPair = { private: newRatchetPriv, public: newRatchetPub }

        const dhOutput2 = getSharedSecret(newRatchetPriv, newRatchetPubKey)
        if (!dhOutput2) throw new Error('Failed to compute DH output 2')

        const [newRootKey2, newSendingChainKey] = await kdfRoot(newRootKey1, dhOutput2)

        state.Rootkey = newRootKey2
        state.recieving_ChainKey = newReceivingChainKey
        state.sending_ChainKey = newSendingChainKey
        state.other_RatchetPubKey = newRatchetPubKey
        state.prevChainLength = state.messagesSent
        state.messagesSent = 0
        state.messagesReceived = 0

    } catch (error) {
        console.error(`[performReceivingDHRatchet] Error for ${sender}:`, error.message)
        throw error
    }
}