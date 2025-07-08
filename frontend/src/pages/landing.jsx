import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../utils/apiRequest.jsx'
import { errorMap, successMap } from '../utils/errorMap.jsx'
import { saveTokens } from '../utils/tokens.jsx'

function Landing() {

    const navigate = useNavigate()
    const [user, setUser] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState('')
    const [showMessage, setShowMessage] = useState(false)

    const handleSignIn = async (e) => {
        e.preventDefault()
        setShowMessage(false)

        try {
            const response = await apiRequest('http://localhost:5001/signin', { user, password })

            if (!response.success) {
                const config = errorMap[response.errorType] || errorMap['server_error']
                const displayMessage = config.useServerMessage ? response.message : config.label
                setMessage(displayMessage)
                setShowMessage(true)
                setTimeout(() => setShowMessage(false), 4000)
                return
            }

            const { access_token, refresh_token } = response.data
            saveTokens(access_token, refresh_token)
            setMessage(successMap.signin.label)
            setShowMessage(true)
            setTimeout(() => navigate('/home'), 1500)

        } catch (err) {
            setMessage("Something went wrong. Please try again.")
            setShowMessage(true)
            setTimeout(() => setShowMessage(false), 4000)
        }
    }

    return (
        <div>
            <h1>Cartesian Theater</h1>

            <form onSubmit={handleSignIn}>
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
                <button type="submit">Sign In</button>
            </form>

            <button onClick={() => navigate('/signup')}>
                Sign Up
            </button>

            {showMessage && <div>{message}</div>}
        </div>
    )
}

export default Landing