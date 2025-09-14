const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Clarifai API configuration (secure on backend)
const CLARIFAI_CONFIG = {
    personalAccessToken: 'YOUR_CLARIFAI_API_KEY_HERE', // Replace with your valid Clarifai PAT
    userId: 'clarifai', // Default for community models
    appId: 'main', // Default main app
    
    // Multiple specialized models for comprehensive nature detection
    models: {
        general: {
            id: 'general-image-recognition',
            version: 'aa7f35c01e0642fda5cf400f543e7c40'
        },
        food: {
            id: 'food-item-recognition',
            version: '1d5fd481e0cf4826aa72ec3ff049e044'
        },
        // Travel and landscape model for water bodies, mountains, etc.
        travel: {
            id: 'travel-2.0',
            version: null
        },
        // Demographics model often good for detailed scene analysis
        demographics: {
            id: 'c0c0ac362b03416da06ab3fa36fb58e3',
            version: null
        },
        // NSFW model sometimes has good general object detection
        nsfw: {
            id: 'e9576d86d2004ed1a38ba0cf39ecb4b1',
            version: null
        }
    },
    
    apiUrl: 'https://api.clarifai.com/v2/models/'
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support large base64 images
app.use(express.static('./')); // Serve static files

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

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

// Enhanced Clarifai API proxy endpoint with multiple model support
app.post('/api/classify', async (req, res) => {
    try {
        console.log('🎯 Received image classification request');
        
        const { imageData } = req.body;
        
        if (!imageData) {
            return res.status(400).json({ error: 'No image data provided' });
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
            return res.json({
                success: false,
                message: 'Clarifai API unavailable, please check API key',
                fallbackToLocal: true
            });
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
                    const generalTopConcept = generalResult.concepts[0];
                    
                    // Use food model if it gives specific results, even with lower confidence
                    const isSpecificFood = !['food', 'fruit', 'vegetable'].includes(topFoodConcept.name.toLowerCase());
                    const isReasonablyConfident = topFoodConcept.value > 0.5; // Lowered threshold
                    
                    if (isReasonablyConfident && isSpecificFood) {
                        bestResult = foodResult;
                        console.log(`🏆 Using specific food result: ${topFoodConcept.name} (${(topFoodConcept.value * 100).toFixed(1)}%)`);
                    } else {
                        console.log(`⚠️ Food model too generic or low confidence: ${topFoodConcept.name} (${(topFoodConcept.value * 100).toFixed(1)}%), keeping general result`);
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
            
            // Smart specificity ranking: prefer meaningful, specific terms
            const specificityRanking = {
                // Highest specificity - exact species/varieties/objects
                'bamboo': 10, 'rose': 10, 'cat': 10, 'oak': 10, 'apple': 10, 'cherry': 10,
                'rabbit': 10, 'eagle': 10, 'tulip': 10, 'pine': 10,
                
                // Specific bird species
                'parrot': 10, 'peacock': 10, 'parakeet': 10, 'owl': 10, 'hawk': 10, 
                'robin': 10, 'sparrow': 10, 'cardinal': 10, 'flamingo': 10,
                
                // Specific animal species (Australian animals, etc.)
                'kangaroo': 10, 'koala': 10, 'wallaby': 10, 'wombat': 10, 'echidna': 10,
                'platypus': 10, 'dingo': 10, 'possum': 10, 'quokka': 10,
                
                // Other specific animals
                'elephant': 10, 'giraffe': 10, 'zebra': 10, 'lion': 10, 'tiger': 10,
                'bear': 10, 'wolf': 10, 'fox': 10, 'deer': 10, 'squirrel': 10,
                'monkey': 10, 'gorilla': 10, 'chimpanzee': 10, 'orangutan': 10,
                
                // Insects and smaller creatures
                'butterfly': 9, 'bee': 9, 'beetle': 9, 'dragonfly': 9, 'spider': 9,
                'ant': 9, 'insect': 7, 'songbird': 8,
                
                // Fungi and decomposers
                'mushroom': 9, 'fungus': 8, 'boletus': 9, 'toadstool': 8,
                
                // High specificity - living things and specific environments  
                'fish': 9, 'coral': 9, 'rainforest': 9, 'jungle': 9, 'reef': 8, 
                'river': 8, 'ocean': 8, 'mountain': 8, 'lake': 8, 'forest': 8,
                'wetland': 8, 'grassland': 8, 'savanna': 8, 'desert': 8,
                
                // Medium-high specificity - useful classifications
                'marsupial': 7, 'mammal': 6, 'reptile': 7, 'amphibian': 7,
                'palm': 7, 'tropical': 6, 'beach': 6,
                
                // Medium-high specificity - general categories (lowered priorities)
                'bird': 5, 'animal': 4, 'flower': 6, 'tree': 5, 'wildlife': 5,
                
                // Medium specificity - general but useful
                'plant': 4, 'flora': 4, 'sand': 4, 'water': 4,
                
                // Low specificity - generic terms
                'wood': 3, 'landscape': 3, 'summer': 3, 'sun': 3, 'petal': 3, 
                'underwater': 3, 'countryside': 3, 'sky': 2,
                
                // Avoid these completely
                'nature': 1, 'outdoors': 1, 'travel': 1, 'alone': 1, 'no person': 0,
                'daylight': 0, 'cute': 1, 'lifestyle': 1, 'panoramic': 3
            };
            
            // Find the concept with highest specificity score
            let bestSpecificityScore = 0;
            for (let concept of bestResult.concepts.slice(0, 6)) {
                if (concept.value > 0.85) { // Lowered threshold to catch specific bird species
                    const specificityScore = specificityRanking[concept.name.toLowerCase()] || 6; // Default medium
                    
                    if (specificityScore > bestSpecificityScore || 
                        (specificityScore === bestSpecificityScore && concept.value > selectedConcept.value)) {
                        selectedConcept = concept;
                        bestSpecificityScore = specificityScore;
                        console.log(`🎯 Found higher specificity: '${concept.name}' (score: ${specificityScore}, confidence: ${(concept.value * 100).toFixed(1)}%)`);
                    }
                }
            }
            
            // Final check: if no high-specificity term found, look for moderately specific ones
            if (bestSpecificityScore === 0) {
                for (let concept of bestResult.concepts.slice(0, 4)) {
                    if (concept.value > 0.85) {
                        const specificityScore = specificityRanking[concept.name.toLowerCase()] || 6;
                        if (specificityScore >= 5) { // At least medium specificity
                            selectedConcept = concept;
                            console.log(`🔍 Using fallback specific term: '${concept.name}' (${(concept.value * 100).toFixed(1)}%)`);
                            break;
                        }
                    }
                }
            }
            
            console.log(`🏆 Final result from ${bestResult.modelKey}:`, selectedConcept.name, `${(selectedConcept.value * 100).toFixed(1)}%`);
            
            return res.json({
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
            });
        }

        return res.json({
            success: false,
            message: 'No confident predictions found from any model',
            allModelResults: allResults
        });

    } catch (error) {
        console.error('❌ Server error:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message 
        });
    }
});

// Health check endpoint with API key validation
app.get('/api/health', async (req, res) => {
    try {
        // Test Clarifai API key with a simple request
        const testUrl = 'https://api.clarifai.com/v2/users/me';
        const testResponse = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Key ${CLARIFAI_CONFIG.personalAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const apiKeyValid = testResponse.ok;
        const statusDetails = {
            status: 'healthy',
            clarifaiConfigured: !!CLARIFAI_CONFIG.personalAccessToken,
            apiKeyValid: apiKeyValid,
            apiKeyStatus: testResponse.status,
            timestamp: new Date().toISOString()
        };

        if (!apiKeyValid) {
            console.log('⚠️ API Key validation failed:', testResponse.status, testResponse.statusText);
            const errorText = await testResponse.text();
            console.log('⚠️ API Key error details:', errorText);
            statusDetails.apiError = errorText;
        }

        res.json(statusDetails);
    } catch (error) {
        console.error('Health check error:', error);
        res.json({
            status: 'healthy',
            clarifaiConfigured: !!CLARIFAI_CONFIG.personalAccessToken,
            apiKeyValid: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log('🚀====================================');
    console.log('🌍 Nature Talks App Backend Started');
    console.log('🚀====================================');
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log(`🔑 Clarifai PAT: ${CLARIFAI_CONFIG.personalAccessToken.substring(0, 8)}...`);
    console.log(`🎯 Smart Models: ${Object.keys(CLARIFAI_CONFIG.models).join(', ')}`);
    console.log('✅ Personal Access Token secure on backend');
    console.log('🧠 Multiple models for specific detection');
    console.log('❌ No CORS issues');
    console.log('🔒 Frontend calls /api/classify endpoint');
    console.log('=====================================');
});