import { useNavigate } from 'react-router-dom'

function Homepage() {
    const navigate = useNavigate()

    return (
        <div>
            {/* Header */}
            <header>
                <div>
                    <h1>Cartesian Theater</h1>
                </div>
                <nav>
                    <button onClick={() => navigate('/login')}>Sign In</button>
                    <button onClick={() => navigate('/signup')}>Sign Up</button>
                </nav>
            </header>

            {/* Hero Section */}
            <main>
                <div>
                    <h1>Cartesian Theater</h1>
                    <p>Making messaging secure.</p>

                    <div>
                        <button onClick={() => navigate('/signup')}>Get Started</button>
                        <button>Learn More</button>
                    </div>
                </div>
            </main>
        </div>
    )
}

export default Homepage