const fetch = require('node-fetch');

// Improved concept mapping for better nature detection
const NATURE_CONCEPT_MAPPING = {
    // Material terms -> Nature scenes
    'wood': 'forest',
    'timber': 'forest', 
    'lumber': 'forest',
    'bark': 'tree',
    'branch': 'tree',
    'trunk': 'tree',
    
    // Generic terms -> Specific nature
    'panoramic': 'landscape',
    'scenery': 'landscape',
    'view': 'landscape',
    'countryside': 'meadow',
    'outdoors': 'nature scene',
    
    // Keep good nature terms as-is
    'forest': 'forest',
    'valley': 'valley',
    'river': 'river',
    'mountain': 'mountain',
    'tree': 'tree',
    'flower': 'flower',
    'lake': 'lake'
};

// Priority ranking for concept selection
const CONCEPT_PRIORITY = {
    // Highest priority - specific nature scenes
    'forest': 15, 'valley': 15, 'river': 15, 'mountain': 15, 'lake': 15,
    'waterfall': 15, 'canyon': 15, 'meadow': 15, 'prairie': 15,
    
    // High priority - nature objects
    'tree': 12, 'flower': 12, 'plant': 10, 'grass': 10,
    'rock': 10, 'stone': 10, 'water': 10,
    
    // Medium priority - animals
    'bird': 8, 'animal': 6, 'butterfly': 12, 'bee': 12,
    
    // Lower priority - generic terms
    'landscape': 5, 'nature scene': 5, 'wood': 3,
    'panoramic': 2, 'scenery': 3, 'view': 2
};

const CLARIFAI_CONFIG = {
    personalAccessToken: process.env.CLARIFAI_PAT || process.env.CLARIFAI_API_KEY || 'YOUR_CLARIFAI_API_KEY_HERE',
    userId: 'clarifai',
    appId: 'main',
    apiUrl: 'https://api.clarifai.com/v2/models/general-image-recognition/outputs'
};

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { imageData } = JSON.parse(event.body);
        
        if (!imageData) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No image data provided' })
            };
        }

        const base64Image = imageData.includes(',') ? imageData.split(',')[1] : imageData;
        
        console.log('🎯 Calling Clarifai with improved nature detection...');

        const response = await fetch(CLARIFAI_CONFIG.apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${CLARIFAI_CONFIG.personalAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: [{
                    data: {
                        image: {
                            base64: base64Image
                        }
                    }
                }]
            })
        });

        if (!response.ok) {
            console.log('❌ Clarifai API error:', response.status);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Clarifai API error'
                })
            };
        }

        const result = await response.json();

        if (result.outputs && result.outputs[0] && result.outputs[0].data && result.outputs[0].data.concepts) {
            let concepts = result.outputs[0].data.concepts.filter(c => c.value > 0.3);
            
            console.log('📋 Raw concepts:', concepts.slice(0, 5).map(c => `${c.name} (${(c.value * 100).toFixed(1)}%)`));
            
            // Apply concept mapping and prioritization
            let bestConcept = null;
            let bestScore = 0;
            
            for (let concept of concepts.slice(0, 8)) { // Check top 8 concepts
                let mappedName = NATURE_CONCEPT_MAPPING[concept.name.toLowerCase()] || concept.name;
                let priority = CONCEPT_PRIORITY[mappedName.toLowerCase()] || 1;
                let score = concept.value * priority;
                
                console.log(`🔍 ${concept.name} -> ${mappedName} (priority: ${priority}, score: ${score.toFixed(2)})`);
                
                if (score > bestScore && concept.value > 0.4) { // Minimum confidence threshold
                    bestScore = score;
                    bestConcept = {
                        name: mappedName,
                        confidence: concept.value,
                        originalName: concept.name
                    };
                }
            }
            
            if (bestConcept) {
                console.log(`🏆 Selected: ${bestConcept.name} (was: ${bestConcept.originalName})`);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        result: {
                            name: bestConcept.name,
                            confidence: bestConcept.confidence,
                            allConcepts: concepts.slice(0, 5).map(c => c.name),
                            source: 'Clarifai-improved',
                            mapping: bestConcept.originalName !== bestConcept.name ? 
                                `${bestConcept.originalName} → ${bestConcept.name}` : null
                        }
                    })
                };
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'No suitable concepts found'
            })
        };

    } catch (error) {
        console.error('❌ Function error:', error);
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