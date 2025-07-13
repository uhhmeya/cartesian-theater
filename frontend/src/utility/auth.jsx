// ********************************* API Request Helpers ********************************* //

const getNewAccessToken = async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    const refreshResponse = await apiRequest('http://localhost:5001/refresh', {
        refresh_token: refreshToken
    }, true);

    if (refreshResponse.success && refreshResponse.data.access_token) {
        localStorage.setItem('access_token', refreshResponse.data.access_token);
        return refreshResponse.data.access_token;
    }

    return null;
};

const retryApiRequest = async (endpoint, payload) => {
    return apiRequest(endpoint, payload, true);
};

// ********************************* apiRequest ********************************* //

export async function apiRequest(endpoint, payload, isRetry = false) {

    try {
        //if access token exists, put it on the header
        const accessToken = getAccessToken();
        const headers = { 'Content-Type': 'application/json' };
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

        //sends api request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const proxyEndpoint = endpoint.replace('http://localhost:5001', '/api');
        const response = await fetch(proxyEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const responseData = await response.json();

        //if access token is expired, get new access token and retry
        if (response.status === 401 && !isRetry && endpoint !== '/api/refresh') {
            const newToken = await getNewAccessToken();
            if (newToken) return await retryApiRequest(endpoint, payload);

            // Couldn't get new token - clear everything and redirect to login
            clearTokens();
            window.location.href = '/login';
            return {
                success: false,
                message: 'Session expired - please login again',
                errorType: 'auth_failed'
            };
        }

        if (!response.ok) {
            const message = response.status >= 500
                ? 'Server error. Please try again later.'
                : responseData.message || `Request failed with status ${response.status}`;

            return {
                success: false,
                message: message,
                errorType: responseData.error_type || 'unknown_error'
            };
        }

        return {
            success: true,
            data: responseData
        };

    } catch (err) {
        // Check if it was a timeout
        if (err.name === 'AbortError') {
            return {
                success: false,
                message: 'Request timed out - please try again',
                errorType: 'timeout_error'
            };
        }

        console.error("Network error:", err);
        return {
            success: false,
            message: 'Network error - please check your connection',
            errorType: 'network_error'
        };
    }
}

// ********************************* Token Management ********************************* //

export const saveTokens = (accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
};

export const getAccessToken = () => {
    return localStorage.getItem('access_token');
};

export const getRefreshToken = () => {
    return localStorage.getItem('refresh_token');
};

export const clearTokens = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
};

export const isLoggedIn = () => {
    return getAccessToken() !== null && getRefreshToken() !== null;
};

// Check if token is expired (optional - use if you want to be proactive)
export const isTokenExpired = (token) => {
    if (!token) return true;

    try {
        // JWT structure: header.payload.signature
        const payload = JSON.parse(atob(token.split('.')[1]));
        // exp is in seconds, Date.now() is in milliseconds
        return payload.exp * 1000 < Date.now();
    } catch {
        return true;
    }
};

// ********************************* Error Map ********************************* //

export const errorMap = {
    // Error messages
    bad_format: {
        label: "Bad Format",
        useServerMessage: true
    },
    invalid_credentials: {
        label: "Bad Credentials"
    },
    username_already_exists: {
        label: "Username already exists"
    },
    server_error: {
        label: "Server error. Try again later."
    },
    timeout_error: {
        label: "Request timed out"
    },

    // Success messages
    signin: {
        label: "Login successful"
    },
    signup: {
        label: "Account created successfully"
    }
};

// ********************************* Message Helpers ********************************* //

export const getErrorMessage = (response) => {
    return response.errorType === 'bad_format'
        ? response.message
        : errorMap[response.errorType]?.label || 'Server error. Try again later.'
}

export const showMessage = (messageText, setMessage, duration = 4000) => {
    setMessage(messageText)
    setTimeout(() => setMessage(''), duration)
}