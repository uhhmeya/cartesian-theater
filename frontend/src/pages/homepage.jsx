import { useNavigate } from 'react-router-dom'

function Homepage() {
    const navigate = useNavigate()

    return (
        <div>
            {/* Header */}
            <header>
                <div className="container">
                    <h1>Cartesian Theater</h1>
                </div>
                <nav>
                    <button onClick={() => navigate('/login')}>Sign In</button>
                    <button onClick={() => navigate('/signup')}>Sign Up</button>
                </nav>
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