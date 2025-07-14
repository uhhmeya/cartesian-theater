import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Homepage from './pages/Homepage.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Dashboard from './pages/dashboard.jsx'
import { useEffect, useState } from 'react'
import './App.css'
import {connectWebSocket} from "./utility/auth.jsx";


function App() {

    const [ws, setWs] = useState(null);
    const [wsStatus, setWsStatus] = useState('connecting');

    useEffect(() => {
        const websocket = connectWebSocket((status, socket) => {
            setWsStatus(status);
            setWs(socket);
        });
        return () => websocket.close();
    }, []);



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