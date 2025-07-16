import { useNavigate } from 'react-router-dom'
import { BackButton, StarryBackground } from '../helpers/components.jsx'
import { clearTokens } from '../helpers/utility.jsx'

function Dashboard() {
    const navigate = useNavigate()

    const handleLogout = () => {
        clearTokens()
        navigate('/login')
    }

    return (
        <div className="dashboard-page">
            <StarryBackground />
            <div className="auth-glow"></div>

            <BackButton to="/" text="Back to Home" />

            <div className="dashboard-container">
                <h1>Welcome to Cartesian Theater</h1>
                <h2>You're logged in!</h2>

                <p style={{ marginBottom: '2rem' }}>
                    This is your secure dashboard. Start exploring the features of Cartesian Theater.
                </p>

                <div className="hero-buttons">
                    <button onClick={() => alert('Feature coming soon!')}>
                        Start Messaging
                    </button>
                    <button className="btn-secondary" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>
        </div>
    )
}

export default Dashboard