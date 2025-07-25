import { useNavigate } from 'react-router-dom'
import { StarryBackground, TextLogo } from '../helpers/components.jsx'

function Homepage() {
    const navigate = useNavigate()

    return (
        <div>
            <header>
                <div className="container">
                    <h1>
                        <TextLogo />
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

            <main className="hero">
                <StarryBackground />

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