import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Stars } from '../components/Stars.jsx'
import { apiRequest } from '../services/api.js'

function Login() {
    const navigate = useNavigate()
    const [message, setMessage] = useState('') //shows "login successful" else shows error message from backend
    const [isLoading, setIsLoading] = useState(false) //set to true in handleClick methods to prevent duplicate api calls
    const [user, setUser] = useState('')
    const [password, setPassword] = useState('')

    const handleLogin = async ({ user, password }) => {
        setMessage('')
        setIsLoading(true)

        const response = await apiRequest('/api/signin', { user, password })

        if (!response.success) {
            setMessage(response.data?.message || 'An error occurred')
            setIsLoading(false)
            return }

        localStorage.setItem('access_token', response.data.access_token)
        localStorage.setItem('refresh_token', response.data.refresh_token)
        localStorage.setItem('username', user)
        setMessage('Login successful')
        setTimeout(() => navigate('/home'), 1000)
    }

    const handleSubmit = e => {
        e.preventDefault()
        if (!isLoading) handleLogin({ user, password })
    }

    return (
        <div className="auth-page">
            <Stars />
            <button className="back-button" onClick={() => navigate('/')}>← Back to Home</button>

            <div className="auth-container">
                <h1>Cartesian Theater</h1>
                <h2>Sign In</h2>

                <form onSubmit={handleSubmit} className="auth-form">
                    <input type="text" placeholder="Username" value={user} onChange={e => setUser(e.target.value)} required disabled={isLoading} />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} />
                    <button type="submit" className="btn-primary" disabled={isLoading}>
                        {isLoading ? 'Loading...' : 'Sign In'}
                    </button>
                </form>

                <button className="btn-secondary" onClick={() => navigate('/signup')}>
                    Need an account? Sign Up
                </button>

                <div className="message-container">
                    {message && (
                        <div className="message">
                            <div className="message__content">{message}</div>
                            <button className="message__close" onClick={() => setMessage('')}>×</button>
                        </div>
                    )}
                </div>
        </div>
        </div>
    )
}

export default Login