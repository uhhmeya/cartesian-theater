import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Homepage from './pages/homepage.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Dashboard from './pages/Dashboard.jsx'
import './styles/App.css'

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Homepage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/home" element={<Dashboard />} />
            </Routes>
        </Router>
    )
}

export default App