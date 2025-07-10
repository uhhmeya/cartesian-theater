import { useNavigate } from 'react-router-dom'
import logo from '../../logo.webp'

function Homepage() {
    const navigate = useNavigate()

    return (
        <div>
            {/* Header */}
            <header>
                <div className="container">
                    <h1>Cartesian Theater</h1>
                    <nav>

                        <button className="nav-signin" onClick={() => navigate('/login')}>Sign In</button>
                        <button className="nav-signup" onClick={() => navigate('/signup')}>Sign Up</button>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <main className="hero">
                <div className="hero-content">
                    <h1>Cartesian Theater.</h1>
                    <p>Making messaging secure</p>

                    <div className="hero-buttons">
                        <button onClick={() => navigate('/signup')}>Get Started</button>
                        <button>Learn More</button>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default Homepage