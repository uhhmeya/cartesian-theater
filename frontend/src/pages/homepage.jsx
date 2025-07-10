import { useNavigate } from 'react-router-dom'
import { StarryBackground, TextLogo, animationStyles } from '../components/styleComponents'
import logo from '../../logo.webp'

function Homepage() {
    const navigate = useNavigate()

    return (
        <div>
            <style>{animationStyles}</style>

            {/* Header */}
            <header>
                <div className="container">
                    <h1 className="logo-container">
                        <TextLogo src={logo} alt="Cartesian Theater" />
                        Cartesian Theater
                    </h1>
                    <nav>
                        <button className="nav-signin" onClick={() => navigate('/login')}>
                            Sign In
                        </button>
                        <button className="nav-signup" onClick={() => navigate('/signup')}>
                            Sign Up
                        </button>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <main className="hero">
                {/* Starry Background */}
                <StarryBackground />

                {/* Purple Glow Center */}
                <div className="purple-glow"></div>

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