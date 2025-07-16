import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm, MessageDisplay, BackButton, StarryBackground } from '../helpers/components.jsx'
import { apiRequest, errorMap, getErrorMessage, saveTokens, useMessage } from '../helpers/utility.jsx'


function Login() {
    const navigate = useNavigate()
    const [message, showMessage, clearMessage] = useMessage()
    const [isLoading, setIsLoading] = useState(false)

    const handleLogin = async ({ user, password }) => {
        clearMessage()
        setIsLoading(true)

        try {
            const response = await apiRequest('http://127.0.0.1:5001/signin', { user, password })

            if (!response.success) {
                showMessage(getErrorMessage(response))
                return setIsLoading(false)
            }

            const { access_token, refresh_token } = response.data
            if (access_token && refresh_token) {
                saveTokens(access_token, refresh_token)
            }

            showMessage(errorMap.signin.label)
            setTimeout(() => navigate('/home'), 1000)

        } catch (error) {
            console.error('Login error:', error)
            showMessage('An unexpected error occurred')
            setIsLoading(false)
        }
    }

    return (
        <div className="auth-page">
            <StarryBackground />
            <div className="auth-glow"></div>
            <BackButton to="/" text="Back to Home" />

            <div className="auth-container">
                <h1>Cartesian Theater</h1>
                <h2>Sign In</h2>

                <AuthForm onSubmit={handleLogin} submitText="Sign In" isLoading={isLoading} />

                <button className="btn-secondary" onClick={() => navigate('/signup')}>
                    Need an account? Sign Up
                </button>

                <MessageDisplay message={message} onClose={clearMessage} type="info" />
            </div>
        </div>
    )
}

export default Login