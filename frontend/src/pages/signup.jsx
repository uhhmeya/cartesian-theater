import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm, MessageDisplay, BackButton } from '../components/AuthComponents.jsx'
import { apiRequest, errorMap, getErrorMessage } from '../utility/auth.jsx'
import { StarryBackground } from '../components/styleComponents'

function Signup() {
    const navigate = useNavigate()
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const timeoutRef = useRef(null)
    const isMountedRef = useRef(true)

    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])

    const handleSignUp = async ({ user, password }) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        setMessage('')
        setIsLoading(true)

        try {
            const response = await apiRequest('http://localhost:5001/signup', { user, password })

            if (!isMountedRef.current) return

            if (!response.success) {
                const errorMessage = getErrorMessage(response)
                setMessage(errorMessage)
                setIsLoading(false)

                timeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        setMessage('')
                    }
                }, 5000)
                return
            }

            setMessage(errorMap.signup.label)
            setTimeout(() => {
                if (isMountedRef.current) {
                    navigate('/login')
                }
            }, 2000)
        } catch (error) {
            console.error('Signup error:', error)
            if (isMountedRef.current) {
                setMessage('An unexpected error occurred')
                setIsLoading(false)

                timeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        setMessage('')
                    }
                }, 5000)
            }
        }
    }

    return (
        <div className="auth-page">
            <StarryBackground />
            <div className="auth-glow"></div>

            <BackButton to="/" text="Back to Home" />

            <div className="auth-container">
                <h1>Cartesian Theater</h1>
                <h2>Create Account</h2>

                <AuthForm onSubmit={handleSignUp} submitText="Sign Up" isLoading={isLoading} />

                <button type="button" className="btn-secondary" onClick={() => navigate('/login')}>
                    Already have an account? Sign In
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

export default Signup