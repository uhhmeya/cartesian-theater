import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm, MessageDisplay, BackButton } from '../components/AuthComponents.jsx'
import { apiRequest, errorMap, getErrorMessage, showMessage, saveTokens } from '../utility/auth.jsx'

function Login() {
    const navigate = useNavigate()
    const [message, setMessage] = useState('')

    const handleLogin = async ({ user, password }) => {
        setMessage('')
        const response = await apiRequest('http://127.0.0.1:5001/signin', { user, password })

        if (!response.success) {
            showMessage(getErrorMessage(response), setMessage)
            return
        }

        // Save tokens on successful login
        if (response.data.access_token && response.data.refresh_token) {
            saveTokens(response.data.access_token, response.data.refresh_token)
        }

        showMessage(errorMap.signin.label, setMessage, 1000)
        setTimeout(() => navigate('/home'), 1000)
    }

    return (
        <div className="auth-page">
            <BackButton to="/" text="Back to Home" />
            <h1>Cartesian Theater</h1>
            <h2>Sign In</h2>

            <AuthForm onSubmit={handleLogin} submitText="Sign In" />

            <button onClick={() => navigate('/signup')}>
                Need an account? Sign Up
            </button>

            <MessageDisplay
                message={message}
                onClose={() => setMessage('')}
                type="info"
            />
        </div>
    )
}

export default Login