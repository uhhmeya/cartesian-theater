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


