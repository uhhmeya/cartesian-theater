import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm, MessageDisplay, BackButton, StarryBackground } from '../helpers/components.jsx'
import { apiRequest, errorMap, getErrorMessage, saveTokens, useMessage, saveUsername } from '../helpers/utility.jsx'

const debug = (category, message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    const prefix = `[${timestamp}] LOGIN ${category}:`
    if (data) {
        console.log(prefix, message, data)
    } else {
        console.log(prefix, message)
    }
}

function Login() {
    const navigate = useNavigate()
    const [message, showMessage, clearMessage] = useMessage()
    const [isLoading, setIsLoading] = useState(false)

    debug('🚀 INIT', 'Login component mounted')

    const handleLogin = async ({ user, password }) => {
        debug('🔐 AUTH', 'Login attempt started', { username: user })
        clearMessage()
        setIsLoading(true)

        try {
            const response = await apiRequest('/api/signin', { user, password })
            debug('📥 RESPONSE', 'Login response received', { success: response.success })

            if (!response.success) {
                const errorMsg = getErrorMessage(response)
                debug('❌ ERROR', 'Login failed', { errorType: response.errorType, message: errorMsg })
                showMessage(errorMsg)
                return setIsLoading(false)
            }

            const { access_token, refresh_token } = response.data
            debug('✅ SUCCESS', 'Login successful', {
                hasAccessToken: !!access_token,
                hasRefreshToken: !!refresh_token
            })

            if (access_token && refresh_token) {
                saveTokens(access_token, refresh_token)
                saveUsername(user)
                debug('💾 SAVED', 'Tokens and username saved')
            }

            showMessage(errorMap.signin.label)
            debug('🎯 REDIRECT', 'Redirecting to dashboard in 1 second')
            setTimeout(() => navigate('/home'), 1000)

        } catch (error) {
            debug('❌ EXCEPTION', 'Login error caught', error)
            showMessage('An unexpected error occurred')
            setIsLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <StarryBackground />
            <BackButton to="/" text="Back to Home" />

            <div className="auth-container">
                <h1>Cartesian Theater</h1>
                <h2>Sign In</h2>

                <AuthForm onSubmit={handleLogin} submitText="Sign In" isLoading={isLoading} />

                <button className="btn-secondary" onClick={() => {
                    debug('🔄 NAVIGATE', 'Navigating to signup')
                    navigate('/signup')
                }}>
                    Need an account? Sign Up
                </button>

                <MessageDisplay message={message} onClose={() => {
                    debug('❌ MESSAGE', 'Closing message')
                    clearMessage()
                }} type="info" />
            </div>
        </div>
    )
}

export default Login