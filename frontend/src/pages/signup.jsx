import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest, errorMap} from '../utility/auth.jsx'

function Signup() {

    const navigate = useNavigate()
    const [user, setUser] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState('')
    const [showMessage, setShowMessage] = useState(false)

    const handleSignUp = async (e) => {
        e.preventDefault()
        setShowMessage(false)

        try {
            const response = await apiRequest('http://localhost:5001/signup', { user, password })

            if (response.success) {
                setMessage(errorMap.signup.label)
                setShowMessage(true)
                setTimeout(() => {
                    setShowMessage(false)
                    navigate('/login')
                }, 2000)
            } else {
                const config = errorMap[response.errorType] || errorMap['server_error']
                const displayMessage = config.useServerMessage ? response.message : config.label
                setMessage(displayMessage)
                setShowMessage(true)
                setTimeout(() => setShowMessage(false), 4000)
            }

        } catch (err) {
            console.error("Sign up failed:", err)
            setMessage("Something went wrong. Please try again.")
            setShowMessage(true)
            setTimeout(() => setShowMessage(false), 4000)
        }
    }

    return (
        <div>
            <h1>Cartesian Theater</h1>
            <h2>Create Account</h2>

            <form onSubmit={handleSignUp}>
                <input
                    type="text"
                    placeholder="Username"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button type="submit">Sign Up</button>
            </form>

            <button onClick={() => navigate('/login')}>
                Back to Sign In
            </button>

            {showMessage && <div>{message}</div>}
        </div>
    )
}

export default Signup