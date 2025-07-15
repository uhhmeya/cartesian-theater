import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm, MessageDisplay, BackButton } from '../components/AuthComponents.jsx'
import { apiRequest, errorMap, getErrorMessage, saveTokens } from '../utility/auth.jsx'
import { StarryBackground } from '../components/StyleComponents.jsx'

function Login() {
    const navigate = useNavigate()
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const timeoutRef = useRef(null)

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])

    const handleLogin = async ({ user, password }) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        setMessage('')
        setIsLoading(true)

        try {
            const response = await apiRequest('http://127.0.0.1:5001/signin', { user, password })

            if (!response.success) {
                const errorMessage = getErrorMessage(response)
                setMessage(errorMessage)
                setIsLoading(false)

                timeoutRef.current = setTimeout(() => {
                    setMessage('')
                }, 5000)
                return
            }

            if (response.data.access_token && response.data.refresh_token) {
                saveTokens(response.data.access_token, response.data.refresh_token)
            }

            setMessage(errorMap.signin.label)
            setTimeout(() => navigate('/home'), 1000)
        } catch (error) {
            console.error('Login error:', error)
            setMessage('An unexpected error occurred')
            setIsLoading(false)

            timeoutRef.current = setTimeout(() => {
                setMessage('')
            }, 5000)
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

                <MessageDisplay
                    message={message}
                    onClose={() => {
                        setMessage('')
                        if (timeoutRef.current) {
                            clearTimeout(timeoutRef.current)
                        }
                    }}
                    type="info"
                />
            </div>
        </div>
    )
}

export default Login