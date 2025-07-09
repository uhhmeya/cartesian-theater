
// ********************************* apiRequest ********************************* //

export async function apiRequest(endpoint, payload) {

    try {
        const accessToken = getAccessToken();
        const headers = { 'Content-Type': 'application/json' };

        if (accessToken)
            headers['Authorization'] = `Bearer ${accessToken}`;


        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
        });

        const responseData = await response.json();

        if (!response.ok) {
            return {
                success: false,
                message: responseData.message || `Request failed with status ${response.status}`,
                errorType: responseData.error_type || 'unknown_error'
            };
        }

        return {
            success: true,
            data: responseData
        };

    } catch (err) {
        console.error("Network error:", err);
        return {
            success: false,
            message: 'Network error - please check your connection',
            errorType: 'network_error'
        };
    }
}

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

    // Success messages
    signin: {
        label: "Login successful"
    },
    signup: {
        label: "Account created successfully"
    }
};

// ********************************* Tokens ********************************* //

export const saveTokens = (accessToken, refreshToken) => {
    console.log("saveTokens called - storing tokens");
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
};

export const getAccessToken = () => {
    return localStorage.getItem('access_token');
};

export const getRefreshToken = () => {
    return localStorage.getItem('refresh_token');
};

//for logout
export const clearTokens = () => {
    console.log("clearTokens called - removing tokens");
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
};

//checks user is logged in
export const isLoggedIn = () => {
    return getAccessToken() !== null && getRefreshToken() !== null;
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