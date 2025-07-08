import React from 'react'
import { useNavigate } from 'react-router-dom'
import { clearTokens, isLoggedIn } from '../utils/tokens.jsx'

function Home() {
    const navigate = useNavigate()

    // Check if user is logged in
    React.useEffect(() => {
        if (!isLoggedIn()) {
            navigate('/')
        }
    }, [navigate])

    const handleLogout = () => {
        clearTokens()
        navigate('/')
    }

    return (
        <div>
            <h1>Cartesian Theater</h1>
            <h2>Welcome! You're logged in.</h2>
            <p>This is your secure messaging dashboard.</p>
            <button onClick={handleLogout}>Logout</button>
        </div>
    )
}

export default Home