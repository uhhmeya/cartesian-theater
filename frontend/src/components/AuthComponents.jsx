import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function AuthForm({ onSubmit, submitText, isLoading = false }) {

    const [user, setUser] = useState('')
    const [password, setPassword] = useState('')

    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit({ user, password })
    }

    return (
        <form onSubmit={handleSubmit} className="auth-form">
            <input
                type="text"
                placeholder="Username"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                required
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />
            <button type="submit" className="btn-primary" disabled={isLoading}>
                {submitText}
            </button>
        </form>
    )
}

function MessageDisplay({ message, onClose, type = "info" }) {
    if (!message) return null

    return (
        <div className={`message message--${type}`}>
            <div className="message__content">
                {message}
            </div>
            <button
                className="message__close"
                onClick={onClose}
                aria-label="Close message"
            >
                ×
            </button>
        </div>
    )
}

function BackButton({ to = "/", text = "Back" }) {

    const navigate = useNavigate()

    return (
        <button
            className="back-button"
            onClick={() => navigate(to)}
        >
            ← {text}
        </button>
    )
}

export { AuthForm, MessageDisplay, BackButton }