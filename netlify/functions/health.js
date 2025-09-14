const fetch = require('node-fetch');

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const CLARIFAI_API_KEY = process.env.CLARIFAI_PAT || process.env.CLARIFAI_API_KEY || process.env.CLARIFAI_PERSONAL_ACCESS_TOKEN || 'YOUR_CLARIFAI_API_KEY_HERE';
        
        // Test Clarifai API key with a simple request
        const testUrl = 'https://api.clarifai.com/v2/users/me';
        const testResponse = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Key ${CLARIFAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const apiKeyValid = testResponse.ok;
        const statusDetails = {
            status: 'healthy',
            clarifaiConfigured: !!CLARIFAI_API_KEY && CLARIFAI_API_KEY !== 'YOUR_CLARIFAI_API_KEY_HERE',
            apiKeyValid: apiKeyValid,
            apiKeyStatus: testResponse.status,
            timestamp: new Date().toISOString(),
            environment: 'netlify-serverless'
        };

        if (!apiKeyValid) {
            console.log('⚠️ API Key validation failed:', testResponse.status, testResponse.statusText);
            try {
                const errorText = await testResponse.text();
                console.log('⚠️ API Key error details:', errorText);
                statusDetails.apiError = errorText;
            } catch (e) {
                statusDetails.apiError = 'Could not read error details';
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(statusDetails)
        };
    } catch (error) {
        console.error('Health check error:', error);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: 'healthy',
                clarifaiConfigured: !!process.env.CLARIFAI_API_KEY,
                apiKeyValid: false,
                error: error.message,
                timestamp: new Date().toISOString(),
                environment: 'netlify-serverless'
            })
        };
    }
};
