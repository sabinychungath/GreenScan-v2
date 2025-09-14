const fetch = require('node-fetch');

// Clarifai API configuration
const CLARIFAI_CONFIG = {
    personalAccessToken: process.env.CLARIFAI_API_KEY || 'YOUR_CLARIFAI_API_KEY_HERE',
    userId: 'clarifai',
    appId: 'main',
    models: {
        general: {
            id: 'general-image-recognition',
            version: 'aa7f35c01e0642fda5cf400f543e7c40'
        },
        food: {
            id: 'food-item-recognition',
            version: '1d5fd481e0cf4826aa72ec3ff049e044'
        }
    },
    apiUrl: 'https://api.clarifai.com/v2/models/'
};

// Helper function to call specific Clarifai model
async function callClarifaiModel(base64Image, modelKey, modelInfo) {
    const requestBody = {
        user_app_id: {
            user_id: CLARIFAI_CONFIG.userId,
            app_id: CLARIFAI_CONFIG.appId
        },
        inputs: [{
            data: {
                image: {
                    base64: base64Image
                }
            }
        }]
    };

    const apiUrl = modelInfo.version 
        ? `${CLARIFAI_CONFIG.apiUrl}${modelInfo.id}/versions/${modelInfo.version}/outputs`
        : `${CLARIFAI_CONFIG.apiUrl}${modelInfo.id}/outputs`;
    
    console.log(`🎯 Trying ${modelKey} model:`, apiUrl);
    
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Authorization': `Key ${CLARIFAI_CONFIG.personalAccessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (response.ok) {
        const result = await response.json();
        if (result.outputs && result.outputs[0] && result.outputs[0].data && result.outputs[0].data.concepts) {
            const concepts = result.outputs[0].data.concepts.filter(c => c.value > 0.3);
            console.log(`✅ ${modelKey} found:`, concepts.slice(0, 3).map(c => `${c.name} (${(c.value * 100).toFixed(1)}%)`));
            return { modelKey, concepts, success: true };
        }
    }
    
    console.log(`❌ ${modelKey} model failed or no results`);
    return { modelKey, success: false };
}

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

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('🎯 Received image classification request');
        
        const { imageData } = JSON.parse(event.body);
        
        if (!imageData) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No image data provided' })
            };
        }

        // Remove data URL prefix if present
        const base64Image = imageData.includes(',') ? imageData.split(',')[1] : imageData;
        
        console.log('🧠 Smart model selection for specific nature detection...');
        
        // Step 1: Always get general classification first
        let generalResult = null;
        let allResults = {};
        
        try {
            const generalInfo = CLARIFAI_CONFIG.models.general;
            generalResult = await callClarifaiModel(base64Image, 'general', generalInfo);
            allResults.general = generalResult;
        } catch (error) {
            console.log(`⚠️ General model error:`, error.message);
        }

        if (!generalResult || !generalResult.success) {
            console.log('⚠️ Clarifai API unavailable, sending fallback response');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Clarifai API unavailable, please check API key',
                    fallbackToLocal: true
                })
            };
        }

        let bestResult = generalResult;
        const topConcepts = generalResult.concepts.slice(0, 3).map(c => c.name.toLowerCase());
        console.log('🔍 General concepts:', topConcepts);

        // Step 2: Only try food model if we detect food/fruit with high confidence
        const foodKeywords = ['fruit', 'apple', 'orange', 'banana', 'food', 'vegetable', 'berry'];
        const hasFoodContent = topConcepts.some(concept => 
            foodKeywords.some(food => concept.includes(food))
        );
        
        if (hasFoodContent) {
            console.log('🎯 Food content detected, trying food model...');
            try {
                const foodInfo = CLARIFAI_CONFIG.models.food;
                const foodResult = await callClarifaiModel(base64Image, 'food', foodInfo);
                allResults.food = foodResult;
                
                if (foodResult.success && foodResult.concepts.length > 0) {
                    const topFoodConcept = foodResult.concepts[0];
                    const isSpecificFood = !['food', 'fruit', 'vegetable'].includes(topFoodConcept.name.toLowerCase());
                    const isReasonablyConfident = topFoodConcept.value > 0.5;
                    
                    if (isReasonablyConfident && isSpecificFood) {
                        bestResult = foodResult;
                        console.log(`🏆 Using specific food result: ${topFoodConcept.name} (${(topFoodConcept.value * 100).toFixed(1)}%)`);
                    }
                }
            } catch (error) {
                console.log(`⚠️ Food model error:`, error.message);
            }
        } else {
            console.log('✅ No food content detected, using general results');
        }

        if (bestResult && bestResult.concepts.length > 0) {
            // Enhanced concept selection for all nature objects
            let selectedConcept = bestResult.concepts[0];
            
            // Smart concept prioritization: prefer objects over locations/states
            console.log('📋 All available concepts:', bestResult.concepts.slice(0, 6).map(c => `${c.name} (${(c.value * 100).toFixed(1)}%)`));
            
            // Smart specificity ranking
            const specificityRanking = {
                'bamboo': 10, 'rose': 10, 'cat': 10, 'oak': 10, 'apple': 10, 'cherry': 10,
                'rabbit': 10, 'eagle': 10, 'tulip': 10, 'pine': 10,
                'parrot': 10, 'peacock': 10, 'parakeet': 10, 'owl': 10, 'hawk': 10,
                'kangaroo': 10, 'koala': 10, 'elephant': 10, 'giraffe': 10,
                'butterfly': 9, 'bee': 9, 'beetle': 9, 'dragonfly': 9,
                'mushroom': 9, 'fish': 9, 'coral': 9,
                'bird': 5, 'animal': 4, 'flower': 6, 'tree': 5, 'wildlife': 5,
                'plant': 4, 'flora': 4, 'water': 4,
                'nature': 1, 'outdoors': 1, 'travel': 1
            };
            
            // Find the concept with highest specificity score
            let bestSpecificityScore = 0;
            for (let concept of bestResult.concepts.slice(0, 6)) {
                if (concept.value > 0.85) {
                    const specificityScore = specificityRanking[concept.name.toLowerCase()] || 6;
                    
                    if (specificityScore > bestSpecificityScore || 
                        (specificityScore === bestSpecificityScore && concept.value > selectedConcept.value)) {
                        selectedConcept = concept;
                        bestSpecificityScore = specificityScore;
                        console.log(`🎯 Found higher specificity: '${concept.name}' (score: ${specificityScore}, confidence: ${(concept.value * 100).toFixed(1)}%)`);
                    }
                }
            }
            
            console.log(`🏆 Final result from ${bestResult.modelKey}:`, selectedConcept.name, `${(selectedConcept.value * 100).toFixed(1)}%`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    result: {
                        name: selectedConcept.name,
                        confidence: selectedConcept.value,
                        allConcepts: bestResult.concepts.slice(0, 5).map(c => c.name),
                        source: `Clarifai-${bestResult.modelKey}`,
                        rawConcepts: bestResult.concepts,
                        modelUsed: bestResult.modelKey,
                        allModelResults: allResults
                    }
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'No confident predictions found from any model',
                allModelResults: allResults
            })
        };

    } catch (error) {
        console.error('❌ Server error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error', 
                details: error.message 
            })
        };
    }
};