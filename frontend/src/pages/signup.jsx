import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Stars } from '../components/Stars.jsx'
import { apiRequest } from '../utility.jsx'

function Signup() {

    const navigate = useNavigate()
    const [user, setUser] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState('')  //shows "login successful" else shows error message from backend
    const [isLoading, setIsLoading] = useState(false) //set to true in handleClick methods to prevent duplicate api calls


    const handleSignUp = async ({ user, password }) => {
        setMessage('')
        setIsLoading(true)
        const response = await apiRequest('/api/signup', { user, password })
        if (!response.success) {
            setMessage(response.data?.message || 'An error occurred')
            setIsLoading(false)
            return}
        setMessage('Account created successfully')
        setTimeout(() => navigate('/login'), 1500)}

    const handleSubmit = e => {
        e.preventDefault()
        if (!isLoading) handleSignUp({ user, password })}

    return (
        <div className="auth-page">
            <Stars />
            <button className="back-button" onClick={() => navigate('/')}>← Back to Home</button>

            <div className="auth-container">
                <h1>Cartesian Theater</h1>
                <h2>Create Account</h2>

                <form onSubmit={handleSubmit} className="auth-form">
                    <input type="text" placeholder="Username" value={user} onChange={e => setUser(e.target.value)} required disabled={isLoading} />
                    <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} />
                    <button type="submit" className="btn-primary" disabled={isLoading}>
                        {isLoading ? 'Loading...' : 'Sign Up'}
                    </button>
                </form>

                <button type="button" className="btn-secondary" onClick={() => navigate('/login')}>
                    Already have an account? Sign In
                </button>

                {message && (
                    <div className="message">
                        <div className="message__content">{message}</div>
                        <button className="message__close" onClick={() => setMessage('')}>×</button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default Signup