const API_BASE = 'http://localhost:5001'

const refreshToken = async () => {
    const refresh_token = localStorage.getItem('refresh_token')
    if (!refresh_token) return false

    try {
        const response = await fetch(`${API_BASE}/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token })
        })
        const data = await response.json()
        if (data.success) {
            localStorage.setItem('access_token', data.access_token)
            return true
        }
        return false
    } catch {
        return false
    }
}

export const apiRequest = async (url, data, method = 'POST') => {
    const makeRequest = (token) => {
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
        console.log('Request to:', `${API_BASE}${url}`)
        console.log('Request headers:', JSON.stringify(headers, null, 2))
        console.log('Token value:', token)
        return fetch(`${API_BASE}${url}`, {
            method,
            headers,
            ...(method !== 'GET' && { body: JSON.stringify(data) })
        })
    }

    try {
        let token = localStorage.getItem('access_token')
        let response = await makeRequest(token)

        if (response.status === 401 && token && await refreshToken()) {
            token = localStorage.getItem('access_token')
            response = await makeRequest(token)
        }

        const result = await response.json()
        return { success: response.ok, data: result }
    } catch {
        return { success: false, data: { message: 'Network error' } }
    }
}