import { getAccessToken } from './tokens.jsx';

export async function apiRequest(endpoint, payload) {

    try {

        console.log("apiRequest.jsx sending request to:", endpoint);
        console.log("apiRequest.jsx payload:", payload);

        const accessToken = getAccessToken();
        const headers = { 'Content-Type': 'application/json' };

        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
            console.log("apiRequest.jsx added Authorization header");
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
        });

        console.log("apiRequest.jsx response status:", response.status);
        console.log("apiRequest.jsx response ok:", response.ok);

        const responseData = await response.json();
        console.log("apiRequest.jsx raw response data:", responseData);

        if (!response.ok) {
            const result = {
                success: false,
                message: responseData.message || `Request failed with status ${response.status}`,
                errorType: responseData.error_type || 'unknown_error',
                status: response.status
            };
            console.log("apiRequest.jsx returning error result:", result);
            return result;
        }

        const result = {
            success: true,
            data: responseData
        };
        console.log("apiRequest.jsx returning success result:", result);
        return result;

    } catch (err) {
        console.error("apiRequest.jsx CATCH BLOCK:", err);

        const result = {
            success: false,
            message: 'Network error - please check your connection',
            errorType: 'network_error'
        };
        console.log("apiRequest.jsx returning network error result:", result);
        return result;
    }
}