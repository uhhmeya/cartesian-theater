import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm, MessageDisplay, BackButton, StarryBackground } from '../helpers/components.jsx'
import { apiRequest, errorMap, getErrorMessage, saveUsername } from '../helpers/utility.jsx'

const debug = (category, message, data = null) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1)
    const prefix = `[${timestamp}] SIGNUP ${category}:`
    if (data) {
        console.log(prefix, message, data)
    } else {
        console.log(prefix, message)
    }
}

function Signup() {
    const navigate = useNavigate()
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const timeoutRef = useRef(null)
    const isMountedRef = useRef(true)

    debug('🚀 INIT', 'Signup component mounted')

    useEffect(() => {
        isMountedRef.current = true
        debug('✅ LIFECYCLE', 'Component mounted')

        return () => {
            debug('🧹 LIFECYCLE', 'Component unmounting')
            isMountedRef.current = false
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])

    const handleSignUp = async ({ user, password }) => {
        debug('📝 AUTH', 'Signup attempt started', { username: user })

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        setMessage('')
        setIsLoading(true)

        try {
            const response = await apiRequest('/api/signup', { user, password })
            debug('📥 RESPONSE', 'Signup response received', { success: response.success })

            if (!isMountedRef.current) {
                debug('⚠️ LIFECYCLE', 'Component unmounted, aborting')
                return
            }

            if (!response.success) {
                const errorMessage = getErrorMessage(response)
                debug('❌ ERROR', 'Signup failed', {
                    errorType: response.errorType,
                    message: errorMessage
                })
                setMessage(errorMessage)
                setIsLoading(false)

                timeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        debug('🧹 MESSAGE', 'Clearing error message')
                        setMessage('')
                    }
                }, 5000)
                return
            }

            saveUsername(user)
            debug('✅ SUCCESS', 'Signup successful, username saved')

            setMessage(errorMap.signup.label)
            debug('🎯 REDIRECT', 'Redirecting to login in 2 seconds')

            setTimeout(() => {
                if (isMountedRef.current) {
                    navigate('/login')
                }
            }, 2000)
        } catch (error) {
            debug('❌ EXCEPTION', 'Signup error caught', error)
            if (isMountedRef.current) {
                setMessage('An unexpected error occurred')
                setIsLoading(false)

                timeoutRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        debug('🧹 MESSAGE', 'Clearing error message')
                        setMessage('')
                    }
                }, 5000)
            }
        }
    }

    return (
        <div className="auth-page">
            <StarryBackground />

            <BackButton to="/" text="Back to Home" />

            <div className="auth-container">
                <h1>Cartesian Theater</h1>
                <h2>Create Account</h2>

                <AuthForm onSubmit={handleSignUp} submitText="Sign Up" isLoading={isLoading} />

                <button type="button" className="btn-secondary" onClick={() => {
                    debug('🔄 NAVIGATE', 'Navigating to login')
                    navigate('/login')
                }}>
                    Already have an account? Sign In
                </button>

                <MessageDisplay
                    message={message}
                    onClose={() => {
                        debug('❌ MESSAGE', 'Closing message')
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