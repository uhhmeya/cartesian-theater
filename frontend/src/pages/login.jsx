import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthForm, MessageDisplay } from '../components/AuthComponents.jsx'
import { apiRequest, saveTokens, errorMap, getErrorMessage, showMessage } from '../utility/auth.jsx'

function Login() {

    const navigate = useNavigate()
    const [user, setUser] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState('')

    const handleSignIn = async (e) => {

        e.preventDefault()
        setMessage('')
        const response = await apiRequest('http://localhost:5001/signin', {user,password })

        //handle bad credentials
        if (!response.success) {
            showMessage(getErrorMessage(response), setMessage)
            return}

        const { access_token, refresh_token } = response.data
        saveTokens(access_token, refresh_token)
        showMessage(errorMap.signin.label, setMessage, 1500)
        setTimeout(() => navigate('/home'), 1500)
    }

    return (
        <div>
            <h1>Login to Cartesian Theater</h1>
            <AuthForm onSubmit={handleSignIn} submitText="Sign In" />
            <button onClick={() => navigate('/signup')}> Sign Up </button>

            <MessageDisplay
                message={message}
                onClose={() => setMessage('')}
                type="error"
            />
        </div>
    )
}

export default Login