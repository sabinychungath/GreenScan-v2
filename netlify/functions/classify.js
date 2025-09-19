const fetch = require('node-fetch');

// Clarifai API configuration
const CLARIFAI_CONFIG = {
    personalAccessToken: process.env.CLARIFAI_PAT || process.env.CLARIFAI_API_KEY || process.env.CLARIFAI_PERSONAL_ACCESS_TOKEN || 'YOUR_CLARIFAI_API_KEY_HERE',
    userId: 'clarifai',
    appId: 'main',
    models: {
        // Use general model but with better concept filtering
        general: {
            id: 'general-image-recognition', 
            version: 'aa7f35c01e0642fda5cf400f543e7c40'
        },
        // Animal model for better species identification when animals are detected
        animals: {
            id: 'animals',
            version: null // Use latest version
        },
        // Food model for plants/fruits
        food: {
            id: 'food-item-recognition',
            version: '1d5fd481e0cf4826aa72ec3ff049e044'
        }
    },
    apiUrl: 'https://api.clarifai.com/v2/models/'
};

// Helper function to query iNaturalist API for animal species identification
async function queryiNaturalist(concepts) {
    try {
        // Focus on Australian fauna, especially snakes and reptiles
        const searchTerms = concepts.filter(concept => 
            ['snake', 'reptile', 'python', 'viper', 'cobra', 'adder', 'taipan', 'brown', 'wildlife', 'animal'].includes(concept.toLowerCase())
        );
        
        if (searchTerms.length === 0) return null;
        
        // Try different search combinations for Australian species
        const searchQueries = [
            `${searchTerms.join(' ')} australia`,
            `australian ${searchTerms[0]}`,
            `${searchTerms[0]} snake australia`,
            searchTerms[0]
        ];
        
        for (const query of searchQueries) {
            console.log('🔍 Searching iNaturalist for:', query);
            
            const url = `https://api.inaturalist.org/v1/taxa/search?q=${encodeURIComponent(query)}&rank=species&is_active=true&place_id=6744`; // 6744 is Australia
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    // Look for snake species first
                    const snakeResult = data.results.find(result => 
                        result.name && (
                            result.name.toLowerCase().includes('snake') ||
                            result.name.toLowerCase().includes('python') ||
                            result.name.toLowerCase().includes('taipan') ||
                            result.name.toLowerCase().includes('adder') ||
                            result.ancestor_ids?.includes(26036) // Reptilia
                        )
                    );
                    
                    if (snakeResult) {
                        // Try to map to known Australian species
                        const commonName = snakeResult.preferred_common_name || snakeResult.name;
                        const scientificName = snakeResult.name;
                        
                        console.log('🐍 Found snake species:', commonName, '(', scientificName, ')');
                        
                        // Map to your database categories
                        const mappedSpecies = mapToAustralianSnake(commonName, scientificName);
                        
                        return {
                            species: mappedSpecies,
                            confidence: 0.8,
                            source: 'iNaturalist',
                            commonName: commonName,
                            scientificName: scientificName
                        };
                    }
                    
                    // Fallback to first result if no specific snake found
                    const firstResult = data.results[0];
                    if (firstResult.preferred_common_name) {
                        return {
                            species: firstResult.preferred_common_name.toLowerCase(),
                            confidence: 0.6,
                            source: 'iNaturalist'
                        };
                    }
                }
            }
        }
        
        return null;
    } catch (error) {
        console.log('❌ iNaturalist query error:', error.message);
        return null;
    }
}

// Helper function to map iNaturalist results to your Australian snake database
function mapToAustralianSnake(commonName, scientificName) {
    const name = (commonName + ' ' + scientificName).toLowerCase();
    
    // Map to your specific Australian snake categories
    if (name.includes('eastern brown') || name.includes('pseudonaja textilis')) return 'eastern-brown-snake';
    if (name.includes('taipan') || name.includes('oxyuranus')) return 'taipan';
    if (name.includes('death adder') || name.includes('acanthophis')) return 'death-adder';
    if (name.includes('tiger snake') || name.includes('notechis')) return 'tiger-snake';
    if (name.includes('red-bellied black') || name.includes('pseudechis porphyriacus')) return 'red-bellied-black-snake';
    if (name.includes('carpet python') || name.includes('morelia spilota')) return 'carpet-python';
    if (name.includes('children') && name.includes('python') || name.includes('antaresia childreni')) return 'childrens-python';
    if (name.includes('woma') || name.includes('aspidites ramsayi')) return 'woma-python';
    
    // Check for general python types
    if (name.includes('python')) return 'python';
    
    // Default to snake if no specific match
    return 'snake';
}

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
            const concepts = result.outputs[0].data.concepts.filter(c => {
                // Lower threshold for flowers and snakes to catch specific varieties
                const isFlower = ['lavender', 'orchid', 'sunflower', 'rose', 'tulip', 'daisy', 'lily', 'lotus', 'iris', 'hibiscus', 'jasmine', 'magnolia', 'violet', 'gardenia', 'marigold', 'carnation', 'chrysanthemum', 'petunia', 'flower', 'bloom', 'blossom'].includes(c.name.toLowerCase());
                const isSnake = ['python', 'cobra', 'viper', 'rattlesnake', 'boa', 'anaconda', 'mamba', 'adder', 'copperhead', 'cottonmouth', 'kingsnake', 'garter', 'corn', 'milk', 'hognose', 'rainbow', 'ball', 'reticulated', 'burmese', 'snake', 'serpent', 'reptile'].includes(c.name.toLowerCase());
                return c.value > ((isFlower || isSnake) ? 0.2 : 0.3);
            });
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
        
        console.log('🧠 Smart model selection for nature/landscape detection...');
        
        // Step 1: Try travel/landscape model first for nature scenes
        let bestResult = null;
        let allResults = {};
        
        try {
            const travelInfo = CLARIFAI_CONFIG.models.travel;
            const travelResult = await callClarifaiModel(base64Image, 'travel', travelInfo);
            allResults.travel = travelResult;
            
            if (travelResult && travelResult.success && travelResult.concepts.length > 0) {
                bestResult = travelResult;
                console.log('✅ Using travel/landscape model results');
            }
        } catch (error) {
            console.log(`⚠️ Travel model error:`, error.message);
        }

        // Step 2: Fallback to general model if travel model fails
        if (!bestResult) {
            try {
                const generalInfo = CLARIFAI_CONFIG.models.general;
                const generalResult = await callClarifaiModel(base64Image, 'general', generalInfo);
                allResults.general = generalResult;
                
                if (generalResult && generalResult.success) {
                    bestResult = generalResult;
                    console.log('📋 Using general model as fallback');
                }
            } catch (error) {
                console.log(`⚠️ General model error:`, error.message);
            }
        }

        if (!bestResult || !bestResult.success) {
            console.log('⚠️ All Clarifai models failed, sending fallback response');
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

        // Continue with the selected best result
        const topConcepts = bestResult.concepts.slice(0, 3).map(c => c.name.toLowerCase());
        console.log('🔍 Top concepts from', bestResult.modelKey + ':', topConcepts);

        // Step 2: Check for animals and use iNaturalist API for better species identification
        const animalKeywords = ['animal', 'snake', 'bird', 'dog', 'cat', 'horse', 'cow', 'pig', 'sheep', 'goat', 'chicken', 'duck', 'rabbit', 'mouse', 'rat', 'squirrel', 'deer', 'bear', 'wolf', 'fox', 'lion', 'tiger', 'elephant', 'giraffe', 'zebra', 'monkey', 'kangaroo', 'koala', 'reptile', 'mammal', 'wildlife', 'fauna'];
        const hasAnimalContent = topConcepts.some(concept => 
            animalKeywords.some(animal => concept.includes(animal) || animal.includes(concept))
        );
        
        if (hasAnimalContent) {
            console.log('🐾 Animal content detected, trying iNaturalist API for better species identification...');
            try {
                const inatResult = await queryiNaturalist(topConcepts);
                if (inatResult && inatResult.species) {
                    console.log('✅ iNaturalist found specific species:', inatResult.species);
                    // Create a result object similar to Clarifai format
                    bestResult = {
                        modelKey: 'iNaturalist',
                        concepts: [{
                            name: inatResult.species,
                            value: inatResult.confidence || 0.8
                        }],
                        success: true
                    };
                } else {
                    console.log('⚠️ iNaturalist did not find specific species, keeping general result');
                }
            } catch (error) {
                console.log('⚠️ iNaturalist API error:', error.message);
            }
        }

        // Step 3: Only try food model if we detect food/fruit with high confidence
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
            
            // Smart specificity ranking with enhanced flower detection
            const specificityRanking = {
                // Specific flowers - highest priority
                'lavender': 18, 'orchid': 18, 'sunflower': 18, 'rose': 18, 'tulip': 18,
                'daisy': 16, 'lily': 16, 'lotus': 16, 'iris': 16, 'hibiscus': 16,
                'jasmine': 16, 'magnolia': 16, 'violet': 16, 'gardenia': 16,
                'marigold': 14, 'carnation': 14, 'chrysanthemum': 14, 'petunia': 14,
                
                // Specific snakes - high priority
                'python': 16, 'cobra': 16, 'viper': 16, 'rattlesnake': 16, 'boa': 16,
                'anaconda': 16, 'mamba': 16, 'adder': 16, 'copperhead': 16, 'cottonmouth': 16,
                'kingsnake': 14, 'garter': 14, 'corn': 14, 'milk': 14, 'hognose': 14,
                'rainbow': 14, 'ball': 14, 'reticulated': 14, 'burmese': 14,
                
                // Other specific nature objects
                'bamboo': 10, 'cat': 10, 'oak': 10, 'apple': 10, 'cherry': 10,
                'rabbit': 10, 'eagle': 10, 'pine': 10,
                'parrot': 10, 'peacock': 10, 'parakeet': 10, 'owl': 10, 'hawk': 10,
                'kangaroo': 10, 'koala': 10, 'elephant': 10, 'giraffe': 10,
                'butterfly': 9, 'bee': 9, 'beetle': 9, 'dragonfly': 9,
                'mushroom': 9, 'fish': 9, 'coral': 9,
                
                // Generic categories (but snake gets higher priority than other animals)
                'snake': 8, 'reptile': 7, 'bird': 5, 'animal': 4, 'flower': 6, 'tree': 5, 'wildlife': 5,
                'plant': 4, 'flora': 4, 'water': 4,
                'nature': 1, 'outdoors': 1, 'travel': 1
            };
            
            // Find the concept with highest specificity score
            let bestSpecificityScore = 0;
            for (let concept of bestResult.concepts.slice(0, 8)) {
                // Lower confidence threshold for flowers and snakes to catch them
                const isFlower = ['lavender', 'orchid', 'sunflower', 'rose', 'tulip', 'daisy', 'lily', 'lotus', 'iris', 'hibiscus', 'jasmine', 'magnolia', 'violet', 'gardenia', 'marigold', 'carnation', 'chrysanthemum', 'petunia', 'flower'].includes(concept.name.toLowerCase());
                const isSnake = ['python', 'cobra', 'viper', 'rattlesnake', 'boa', 'anaconda', 'mamba', 'adder', 'copperhead', 'cottonmouth', 'kingsnake', 'garter', 'corn', 'milk', 'hognose', 'rainbow', 'ball', 'reticulated', 'burmese', 'snake', 'serpent', 'reptile'].includes(concept.name.toLowerCase());
                const confidenceThreshold = (isFlower || isSnake) ? 0.3 : 0.85;
                
                if (concept.value > confidenceThreshold) {
                    const specificityScore = specificityRanking[concept.name.toLowerCase()] || 6;
                    
                    if (specificityScore > bestSpecificityScore || 
                        (specificityScore === bestSpecificityScore && concept.value > selectedConcept.value)) {
                        selectedConcept = concept;
                        bestSpecificityScore = specificityScore;
                        console.log(`🎯 Found higher specificity: '${concept.name}' (score: ${specificityScore}, confidence: ${(concept.value * 100).toFixed(1)}%)`);
                    }
                }
            }
            
            // SNAKE DETECTION OVERRIDE - If "snake" is in concepts but not selected, override
            const hasSnake = bestResult.concepts.some(c => c.name.toLowerCase().includes('snake') || c.name.toLowerCase().includes('reptile'));
            if (hasSnake && !selectedConcept.name.toLowerCase().includes('snake') && !selectedConcept.name.toLowerCase().includes('reptile')) {
                const snakeConcept = bestResult.concepts.find(c => c.name.toLowerCase().includes('snake') || c.name.toLowerCase().includes('reptile'));
                if (snakeConcept && snakeConcept.value > 0.3) {
                    console.log(`🐍 SNAKE OVERRIDE: Found ${snakeConcept.name} in concepts, overriding ${selectedConcept.name}`);
                    selectedConcept = snakeConcept;
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
