import React from 'react'
import { useNavigate } from 'react-router-dom'
import { clearTokens, isLoggedIn } from '../utility/auth.jsx'
import { StarryBackground } from '../components/styleComponents'

function Dashboard() {
    const navigate = useNavigate()

    // Check if user is logged in when page first loads
    React.useEffect(() => {if (!isLoggedIn()) navigate('/')}, [navigate])

    const handleLogout = () => {
        clearTokens()
        navigate('/login')
    }

    return (
        <div className="dashboard-page">
            <StarryBackground />
            <div className="auth-glow"></div>

            <div className="dashboard-container">
                <h1>Cartesian Theater</h1>
                <h2>Welcome! You're logged in.</h2>
                <p>This is your secure messaging dashboard.</p>
                <button className="btn-primary" onClick={handleLogout}>Logout</button>
            </div>
        </div>
    )
}

export default Dashboard