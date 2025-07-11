import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm, MessageDisplay, BackButton } from '../components/AuthComponents.jsx'
import { apiRequest, errorMap, getErrorMessage, showMessage } from '../utility/auth.jsx'
import { StarryBackground } from '../components/styleComponents'

function Signup() {
    const navigate = useNavigate()
    const [message, setMessage] = useState('')

    const handleSignUp = async ({ user, password }) => {
        setMessage('')
        const response = await apiRequest('http://localhost:5001/signup', { user, password })

        if (!response.success) {
            showMessage(getErrorMessage(response), setMessage)
            return
        }

        showMessage(errorMap.signup.label, setMessage, 2000)
        setTimeout(() => navigate('/login'), 2000)
    }

    return (
        <div className="auth-page">
            <StarryBackground />
            <div className="auth-glow"></div>

            <BackButton to="/" text="Back to Home" />

            <div className="auth-container">
                <h1>Cartesian Theater</h1>
                <h2>Create Account</h2>

                <AuthForm onSubmit={handleSignUp} submitText="Sign Up" />

                <button className="btn-secondary" onClick={() => navigate('/login')}>
                    Already have an account? Sign In
                </button>

                <MessageDisplay
                    message={message}
                    onClose={() => setMessage('')}
                    type="info"
                />
            </div>
        </div>
    )
}

export default Signup