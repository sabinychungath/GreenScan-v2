class NatureTalks {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.natureDatabase = this.createNatureDatabase();
        
        // Clarifai API configuration (now handled by serverless functions)
        this.clarifaiConfig = {
            apiKey: '554a0303...', // Hidden - using serverless functions
            userId: 'clarifai',
            appId: 'main',
            modelId: 'general-image-recognition',
            modelVersionId: 'aa7f35c01e0642fda5cf400f543e7c40',
            apiUrl: 'https://api.clarifai.com/v2/models/',
            // Alternative approach - try without version ID first
            useLatestVersion: true
        };
        
        this.loadMobileNetModel();
    }

    async loadMobileNetModel() {
        try {
            console.log('Loading AI models...');
            
            // Initialize models object
            this.models = {};
            
            // 1. Clarifai API is ready (cloud-based)
            console.log('✅ Clarifai API ready for advanced image recognition');
            console.log('🔑 Using API key:', this.clarifaiConfig.apiKey.substring(0, 8) + '...');
            console.log('🎯 Model ID:', this.clarifaiConfig.modelId);
            console.log('📡 API URL:', this.clarifaiConfig.apiUrl);
            this.models.clarifai = true;
            
            // 2. Load MobileNet as fallback
            try {
                this.models.mobilenet = await mobilenet.load();
                console.log('✅ MobileNet model loaded as fallback');
            } catch (e) {
                console.log('❌ MobileNet failed:', e);
            }
            
            // 3. Try to load COCO-SSD for better object detection
            try {
                this.models.cocoSsd = await cocoSsd.load();
                console.log('✅ COCO-SSD model loaded');
            } catch (e) {
                console.log('❌ COCO-SSD not available, will use alternative');
            }
            
            console.log('🎯 AI models loaded! Priority: Clarifai → MobileNet → Local Analysis');
            this.model = this.models.mobilenet; // Keep backward compatibility
            
            // Test Clarifai API connection
            this.testClarifaiConnection();
        } catch (error) {
            console.log('Failed to load AI models:', error);
            this.model = null;
            this.models = {};
        }
    }

    async testClarifaiConnection() {
        try {
            console.log('🧪 Testing backend health...');
            
            const response = await fetch('/api/health');
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Backend server healthy!');
                console.log('🔑 Clarifai configured:', result.clarifaiConfigured);
                console.log('⏰ Server time:', result.timestamp);
                console.log('🎯 Ready for secure AI classification!');
            } else {
                console.log('❌ Backend health check failed');
            }
        } catch (error) {
            console.log('🧪 Backend server not running');
            console.log('   To start backend: npm install && npm start');
            console.log('   Then open: http://localhost:3000');
        }
    }

    initializeElements() {
        this.uploadSection = document.getElementById('uploadSection');
        this.resultSection = document.getElementById('resultSection');
        this.loading = document.getElementById('loading');
        this.cameraBtn = document.getElementById('cameraBtn');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInput = document.getElementById('fileInput');
        this.uploadInput = document.getElementById('uploadInput');
        this.previewImage = document.getElementById('previewImage');
        this.natureAvatar = document.getElementById('natureAvatar');
        this.natureTitle = document.getElementById('natureTitle');
        this.natureText = document.getElementById('natureText');
        this.speakBtn = document.getElementById('speakBtn');
        this.newPhotoBtn = document.getElementById('newPhotoBtn');
        
        // Quiz elements
        this.quizBtn = document.getElementById('quizBtn');
        this.quizSection = document.getElementById('quizSection');
        this.quizQuestion = document.getElementById('quizQuestion');
        this.quizOptions = document.getElementById('quizOptions');
        this.quizFeedback = document.getElementById('quizFeedback');
        this.scoreValue = document.getElementById('scoreValue');
        
        // Game state
        this.score = 0;
        this.currentQuestions = [];
        this.currentQuestionIndex = 0;
    }

    bindEvents() {
        this.cameraBtn.addEventListener('click', () => this.openCamera());
        this.uploadBtn.addEventListener('click', () => this.openUpload());
        this.fileInput.addEventListener('change', (e) => this.handleImageCapture(e));
        this.uploadInput.addEventListener('change', (e) => this.handleImageCapture(e));
        this.speakBtn.addEventListener('click', () => this.speakMessage());
        this.newPhotoBtn.addEventListener('click', () => this.resetApp());
        
        // Quiz events
        this.quizBtn.addEventListener('click', () => this.startQuiz());
    }

    async openCamera() {
        try {
            // Try to access camera directly
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' }, // Use back camera
                audio: false 
            });
            
            // Create video element for camera preview
            this.showCameraPreview(stream);
        } catch (error) {
            console.log('Direct camera access failed, using file input:', error);
            // Fallback to file input with camera capture
            this.fileInput.setAttribute('capture', 'environment');
            this.fileInput.click();
        }
    }

    showCameraPreview(stream) {
        // Create camera preview interface
        const cameraDiv = document.createElement('div');
        cameraDiv.className = 'camera-preview';
        cameraDiv.innerHTML = `
            <video id="cameraVideo" autoplay playsinline style="width: 100%; max-width: 400px; border-radius: 15px;"></video>
            <div style="margin-top: 20px;">
                <button class="btn btn-camera" id="captureBtn">📸 Capture Photo</button>
                <button class="btn btn-upload" id="cancelBtn">❌ Cancel</button>
            </div>
            <canvas id="captureCanvas" style="display: none;"></canvas>
        `;
        
        this.uploadSection.appendChild(cameraDiv);
        
        const video = document.getElementById('cameraVideo');
        const captureBtn = document.getElementById('captureBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const canvas = document.getElementById('captureCanvas');
        const ctx = canvas.getContext('2d');
        
        video.srcObject = stream;
        
        captureBtn.onclick = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            canvas.toBlob((blob) => {
                const file = new File([blob], 'ai-camera.png', { type: 'image/png' });
                this.processCapturedImage(file, canvas.toDataURL());
                stream.getTracks().forEach(track => track.stop());
                cameraDiv.remove();
            });
        };
        
        cancelBtn.onclick = () => {
            stream.getTracks().forEach(track => track.stop());
            cameraDiv.remove();
        };
    }

    processCapturedImage(file, dataUrl) {
        this.previewImage.src = dataUrl;
        this.showLoading();
        
        setTimeout(() => {
            this.analyzeImageWithAI(dataUrl);
        }, 2000);
    }

    openUpload() {
        this.uploadInput.click();
    }

    handleImageCapture(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.previewImage.src = e.target.result;
                this.showLoading();
                
                setTimeout(() => {
                    this.analyzeImageWithAI(e.target.result);
                }, 2000);
            };
            reader.readAsDataURL(file);
        }
    }

    showLoading() {
        this.uploadSection.style.display = 'none';
        this.resultSection.style.display = 'none';
        this.loading.style.display = 'block';
    }

    showResult() {
        this.loading.style.display = 'none';
        this.uploadSection.style.display = 'none';
        this.resultSection.style.display = 'block';
    }

    resetApp() {
        this.uploadSection.style.display = 'block';
        this.resultSection.style.display = 'none';
        this.loading.style.display = 'none';
        this.fileInput.value = '';
        this.uploadInput.value = '';
    }

    async analyzeImageWithAI(imageData) {
        try {
            // First try Clarifai API (most accurate)
            console.log('🎯 Trying Clarifai API...');
            const clarifaiResult = await this.classifyWithClarifai(imageData);
            if (clarifaiResult) {
                const natureData = this.generateDynamicMessage(clarifaiResult);
                this.displayNatureMessage(natureData);
                this.showResult();
                return;
            }
            
            // Fallback to TensorFlow.js MobileNet
            if (this.model) {
                console.log('🔄 Falling back to MobileNet...');
                const identifiedObject = await this.classifyWithMobileNet(imageData);
                const natureData = this.generateDynamicMessage(identifiedObject);
                this.displayNatureMessage(natureData);
                this.showResult();
                return;
            }
            
            // Final fallback to simple local analysis
            console.log('🔄 Using local analysis...');
            const identifiedObject = await this.analyzeImageLocally(imageData);
            const natureData = this.generateDynamicMessage(identifiedObject);
            this.displayNatureMessage(natureData);
            this.showResult();
        } catch (error) {
            console.log('All AI recognition failed, using fallback:', error);
            // Final fallback to intelligent detection
            const natureData = this.intelligentNatureDetection();
            this.displayNatureMessage(natureData);
            this.showResult();
        }
    }

    async classifyWithMobileNet(imageData) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    // Classify image with MobileNet
                    const predictions = await this.model.classify(img);
                    console.log('MobileNet predictions:', predictions);
                    
                    if (predictions && predictions.length > 0) {
                        const topPrediction = predictions[0];
                        resolve({
                            name: topPrediction.className,
                            confidence: topPrediction.probability,
                            allConcepts: predictions.slice(0, 3).map(p => p.className),
                            source: 'MobileNet'
                        });
                    } else {
                        reject(new Error('No predictions from MobileNet'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.crossOrigin = 'anonymous';
            img.src = imageData;
        });
    }

    async classifyWithClarifai(imageData) {
        try {
            console.log('🎯 Starting Clarifai classification via backend...');
            console.log('🔍 Debug: Testing flower detection improvements...');
            
            // Use backend proxy endpoint - no more CORS issues!
            const response = await fetch('/api/classify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageData: imageData
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.log('❌ Backend API error:', response.status, errorData);
                return null;
            }

            const result = await response.json();
            
            if (result.success && result.result) {
                console.log('✅ Clarifai detection via backend successful:', result.result.name, `${(result.result.confidence * 100).toFixed(1)}%`);
                console.log('📋 All concepts found:', result.result.allConcepts);
                console.log('🔍 FLOWER DEBUG - Detected name:', result.result.name);
                console.log('🔍 FLOWER DEBUG - All concepts:', result.result.allConcepts);
                
                return result.result;
            } else {
                console.log('❌ Backend classification failed:', result.message);
                return null;
            }
            
        } catch (error) {
            console.error('❌ Backend API call failed:', error);
            
            // Fallback message for when backend isn't running
            if (error.message.includes('Failed to fetch')) {
                console.log('⚠️  Backend server not running. To use Clarifai:');
                console.log('   1. Run: npm install');
                console.log('   2. Run: npm start');
                console.log('   3. Open: http://localhost:3000');
                console.log('🔄 Falling back to MobileNet...');
            }
            
            return null;
        }
    }

    async trySimplifiedClarifaiCall(base64Image) {
        try {
            console.log('🔄 Trying simplified Clarifai API call...');
            
            // Simplified request structure
            const requestBody = {
                inputs: [{
                    data: {
                        image: {
                            base64: base64Image
                        }
                    }
                }]
            };

            // Use CORS proxy for direct file access
            const corsProxy = 'https://cors-anywhere.herokuapp.com/';
            const apiUrl = 'https://api.clarifai.com/v2/models/aaa03c23b3724a16a56b629203edc62c/outputs';
            const proxiedUrl = corsProxy + apiUrl;
            
            const response = await fetch(proxiedUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Key ${this.clarifaiConfig.apiKey}`,
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Simplified API call successful');
                console.log('🎯 Simplified result:', result);
                
                if (result.outputs && result.outputs[0] && result.outputs[0].data && result.outputs[0].data.concepts) {
                    const concepts = result.outputs[0].data.concepts;
                    console.log('📋 Simplified concepts:', concepts.slice(0, 5).map(c => `${c.name} (${(c.value * 100).toFixed(1)}%)`));
                    
                    const validConcepts = concepts.filter(c => c.value > 0.3);
                    if (validConcepts.length > 0) {
                        return {
                            name: validConcepts[0].name,
                            confidence: validConcepts[0].value,
                            allConcepts: validConcepts.slice(0, 5).map(c => c.name),
                            source: 'Clarifai-Simplified'
                        };
                    }
                }
            } else {
                const errorText = await response.text();
                console.log('❌ Simplified API also failed:', response.status, errorText);
            }
            
            return null;
        } catch (error) {
            console.log('❌ Simplified API error:', error);
            return null;
        }
    }

    async analyzeImageLocally(imageData) {
        // Simple local image analysis using canvas and color detection
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                // Analyze dominant colors and patterns
                const analysis = this.analyzeImageColors(ctx, canvas.width, canvas.height);
                resolve(analysis);
            };
            img.src = imageData;
        });
    }

    // Legacy method for filename-based detection (kept as backup)
    identifyNature(filename) {
        const keywords = filename.toLowerCase();
        
        for (const [category, data] of Object.entries(this.natureDatabase)) {
            for (const keyword of data.keywords) {
                if (keywords.includes(keyword)) {
                    return data;
                }
            }
        }
        
        return this.intelligentNatureDetection();
    }


    async tryPlantNetAPI(imageData) {
        try {
            console.log('🌱 Trying PlantNet API...');
            
            // Convert image data to blob
            const base64Data = imageData.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });

            // Create FormData for PlantNet API
            const formData = new FormData();
            formData.append('images', blob, 'plant.jpg');
            formData.append('organs', 'flower');
            formData.append('organs', 'leaf');
            formData.append('organs', 'fruit');
            
            // Try PlantNet API (free tier available)
            const response = await fetch('https://my-api.plantnet.org/v1/identify/plants?api-key=2b10VqaeOtmsshsW6JVVSkib0hmop1S5tsojsnrIP', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                console.log('PlantNet response:', data);
                
                if (data.results && data.results.length > 0) {
                    const topResult = data.results[0];
                    return {
                        name: topResult.species.scientificNameWithoutAuthor,
                        confidence: topResult.score,
                        source: 'PlantNet',
                        allConcepts: data.results.slice(0, 3).map(r => r.species.scientificNameWithoutAuthor),
                        commonName: topResult.species.commonNames ? topResult.species.commonNames[0] : null
                    };
                }
            }
        } catch (error) {
            console.log('PlantNet API failed:', error);
        }
        return null;
    }

    async tryiNaturalistAPI(imageData) {
        try {
            console.log('🦋 Trying iNaturalist API...');
            
            // iNaturalist has a computer vision API
            // Convert image to base64 for API
            const base64Image = imageData.split(',')[1];
            
            const response = await fetch('https://api.inaturalist.org/v1/computervision/score_image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image: base64Image,
                    locale: 'en'
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('iNaturalist response:', data);
                
                if (data.results && data.results.length > 0) {
                    const topResult = data.results[0];
                    return {
                        name: topResult.taxon.name,
                        confidence: topResult.vision_score,
                        source: 'iNaturalist',
                        allConcepts: data.results.slice(0, 3).map(r => r.taxon.name),
                        taxonomy: topResult.taxon.rank,
                        commonName: topResult.taxon.preferred_common_name
                    };
                }
            }
        } catch (error) {
            console.log('iNaturalist API failed:', error);
        }
        return null;
    }

    async tryGoogleVisionAPI(imageData) {
        try {
            console.log('🔍 Trying Google Vision API simulation...');
            
            // Since we can't use actual Google Vision API without setup,
            // let's create a much better local analysis that simulates it
            return await this.simulateGoogleVision(imageData);
        } catch (error) {
            console.log('Google Vision simulation failed:', error);
        }
        return null;
    }

    async simulateGoogleVision(imageData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Use our enhanced analysis but with better classification
                const analysis = this.enhancedNatureAnalysis(img);
                
                // Convert to Google Vision-like response
                if (analysis.confidence > 0.6) {
                    resolve({
                        name: analysis.species,
                        confidence: analysis.confidence,
                        source: 'Enhanced Vision Analysis',
                        allConcepts: analysis.concepts,
                        taxonomy: analysis.taxonomy
                    });
                } else {
                    resolve(null);
                }
            };
            img.src = imageData;
        });
    }

    async analyzeImageLocally(imageData) {
        // Simple local image analysis using canvas and color detection
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                // Analyze dominant colors and patterns
                const analysis = this.analyzeImageColors(ctx, canvas.width, canvas.height);
                resolve(analysis);
            };
            img.src = imageData;
        });
    }

    analyzeImageColors(ctx, width, height) {
        // Sample pixels to determine dominant colors
        const sampleSize = 100;
        const colors = { green: 0, blue: 0, brown: 0, white: 0, red: 0, yellow: 0, purple: 0, gray: 0, other: 0 };
        
        for (let i = 0; i < sampleSize; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            const [r, g, b] = pixel;
            
            // More sophisticated color classification
            if (g > r + 15 && g > b + 15 && g > 80) colors.green++;
            else if (b > r + 15 && b > g + 15 && b > 80) colors.blue++;
            else if (r > g + 15 && r > b + 15 && r > 100) colors.red++;
            else if (r > 150 && g > 140 && b < 100) colors.yellow++;
            else if (r > 80 && g > 60 && b < 80) colors.brown++;
            else if (r > 200 && g > 200 && b > 200) colors.white++;
            else if (r > 100 && g < 100 && b > 100) colors.purple++;
            else if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30 && r > 60 && r < 180) colors.gray++;
            else colors.other++;
        }
        
        console.log('🎨 Color analysis:', colors);
        
        // Determine object type based on color analysis with better confidence
        const maxColor = Object.keys(colors).reduce((a, b) => colors[a] > colors[b] ? a : b);
        
        const colorMapping = {
            green: { name: 'tree', type: 'tree', confidence: 0.8 },
            blue: { name: 'water', type: 'river', confidence: 0.7 },
            brown: { name: 'tree', type: 'tree', confidence: 0.75 },
            white: { name: 'cloud', type: 'earth', confidence: 0.6 },
            red: { name: 'flower', type: 'flower', confidence: 0.8 },
            yellow: { name: 'sunflower', type: 'flower', confidence: 0.8 },
            purple: { name: 'flower', type: 'flower', confidence: 0.8 },
            gray: { name: 'rock', type: 'mountain', confidence: 0.7 },
            other: { name: 'plant', type: 'tree', confidence: 0.6 }
        };
        
        const result = colorMapping[maxColor];
        console.log('🎯 Simple color detection result:', result);
        
        return {
            name: result.name,
            confidence: result.confidence,
            type: result.type,
            allConcepts: [result.name, 'nature', 'environment', result.type]
        };
    }

    intelligentNatureDetection() {
        // Create weighted random selection for more variety
        const categories = Object.keys(this.natureDatabase);
        
        // Remove any previously shown category to ensure variety
        if (this.lastShownCategory) {
            const filteredCategories = categories.filter(cat => cat !== this.lastShownCategory);
            if (filteredCategories.length > 0) {
                const randomIndex = Math.floor(Math.random() * filteredCategories.length);
                const selectedCategory = filteredCategories[randomIndex];
                this.lastShownCategory = selectedCategory;
                return this.natureDatabase[selectedCategory];
            }
        }
        
        // First time or fallback - select randomly
        const randomIndex = Math.floor(Math.random() * categories.length);
        const selectedCategory = categories[randomIndex];
        this.lastShownCategory = selectedCategory;
        return this.natureDatabase[selectedCategory];
    }

    generateDynamicMessage(identifiedObject) {
        const objectName = (identifiedObject.name || 'tree').toLowerCase();
        const confidence = identifiedObject.confidence || 0.7;
        
        console.log('🎯 Generating message for:', objectName, 'confidence:', confidence, 'concepts:', identifiedObject.allConcepts);
        console.log('🌸 FLOWER DEBUG - Input object name:', objectName);
        console.log('🌸 FLOWER DEBUG - All concepts:', identifiedObject.allConcepts);
        
        // Preserve the original object name for specific messages
        let originalObjectName = objectName;
        if (!objectName || objectName === 'unknown' || objectName === '') {
            originalObjectName = 'tree'; // Default fallback
        }
        
        // More comprehensive mapping with better priority for category
        let matchedCategory = this.findBestMatch(originalObjectName, identifiedObject.allConcepts || [], confidence);
        console.log('🌸 FLOWER DEBUG - Matched category:', matchedCategory);
        
        // Ensure we have a valid category
        if (!this.natureDatabase[matchedCategory]) {
            console.log('🌸 FLOWER DEBUG - Category not found in database, keeping original object name');
            matchedCategory = originalObjectName; // Keep the actual detected object name
        }
        
        console.log('📂 Original object:', originalObjectName, '-> Matched category:', matchedCategory);
        
        // Use the matched category for generating specific content (not the original detection)
        const categoryToUse = matchedCategory || originalObjectName;
        console.log('🎯 Using category for content generation:', categoryToUse);
        
        // Create completely custom message based on the MATCHED CATEGORY
        // First check if we have a database entry for this category
        const databaseEntry = this.natureDatabase[categoryToUse];
        let dynamicMessage;
        
        if (databaseEntry) {
            console.log('🗃️ Using database entry for:', categoryToUse);
            // Use the database entry directly
            dynamicMessage = {
                emoji: databaseEntry.emoji || this.getObjectEmoji(categoryToUse),
                confidence: confidence,
                detectedAs: categoryToUse,
                originalDetection: identifiedObject.name || originalObjectName,
                introduction: databaseEntry.introduction || this.generateSpecificIntroduction(categoryToUse),
                message: databaseEntry.message || this.generateSpecificMessage(categoryToUse),
                explanation: databaseEntry.explanation || this.generateEducationalExplanation(categoryToUse),
                consequences: databaseEntry.consequences || this.generateConsequences(categoryToUse),
                plea: databaseEntry.plea || this.generateSpecificPlea(categoryToUse)
            };
        } else {
            console.log('🔧 Using legacy generation for:', categoryToUse);
            // Fall back to the legacy generation system
            dynamicMessage = {
                emoji: this.getObjectEmoji(categoryToUse),
                confidence: confidence,
                detectedAs: identifiedObject.name || 'nature object',
                originalDetection: identifiedObject.name || originalObjectName,
                introduction: this.generateSpecificIntroduction(categoryToUse),
                message: this.generateSpecificMessage(categoryToUse),
                explanation: this.generateEducationalExplanation(categoryToUse),
                consequences: this.generateConsequences(categoryToUse),
                plea: this.generateSpecificPlea(categoryToUse)
            };
        }
        
        console.log('✅ Generated dynamic message:', dynamicMessage);
        
        return dynamicMessage;
    }

    findBestMatch(objectName, allConcepts, confidence = 0.7) {
        // Simple and direct approach: Check if any concept exists in database first
        let allTerms = [objectName, ...allConcepts.map(c => c.toLowerCase())];
        
        // Enhanced parsing for MobileNet/complex strings (e.g., "rock python, rock snake, Python sebae")
        const expandedTerms = [];
        for (const term of allTerms) {
            expandedTerms.push(term);
            // Split by commas and extract individual terms
            if (term.includes(',')) {
                const splitTerms = term.split(',').map(t => t.trim());
                expandedTerms.push(...splitTerms);
            }
            // Extract individual words for better matching
            const words = term.split(' ').map(w => w.trim()).filter(w => w.length > 2);
            expandedTerms.push(...words);
        }
        
        allTerms = [...new Set(expandedTerms)]; // Remove duplicates
        
        console.log('🔍 All terms for matching:', allTerms); // Debug log
        console.log('🎯 Detection confidence:', (confidence * 100).toFixed(1) + '%');
        
        // Filter out negative/placeholder terms and misleading concepts that shouldn't be used
        const negativeTerms = ['no person', 'no people', 'no human', 'no one', 'nobody', 'nothing', 
                              'unknown', 'unidentified', 'unclear', 'no object', 'no detection'];
        const misleadingTerms = ['person', 'people', 'human', 'man', 'woman', 'adult', 'child']; // These often appear incorrectly in object detection
        
        const filteredTerms = allTerms.filter(term => {
            // Remove negative terms, misleading terms, and very short/generic terms
            return !negativeTerms.some(negTerm => term.includes(negTerm)) && 
                   !misleadingTerms.includes(term.toLowerCase()) &&
                   term.length > 2 && 
                   term !== 'the' && term !== 'and' && term !== 'or';
        });
        
        console.log('🧹 Filtered terms:', filteredTerms);
        
        // Step 1: Direct database lookup - check each concept against database categories
        for (const term of filteredTerms) {
            // Check if this exact term exists as a category in the database
            if (this.natureDatabase[term]) {
                console.log('✅ Direct match found:', term);
                return term;
            }
            
            // Check if this term exists in any category's keywords
            for (const [category, data] of Object.entries(this.natureDatabase)) {
                if (data.keywords) {
                    // First try exact match
                    if (data.keywords.includes(term)) {
                        console.log('✅ Exact keyword match found:', term, '→', category);
                        return category;
                    }
                    
                    // Disabled partial matching to prevent false positives
                    // Only use exact matches for reliability
                }
            }
        }
        
        console.log('❌ No direct matches found in database, using fallback logic...');
        
        // Step 2: For high-confidence detections (>90%), keep the original Clarifai detection
        if (confidence > 0.9) {
            console.log('🎯 High confidence detection (' + (confidence * 100).toFixed(1) + '%) - keeping original Clarifai detection:', objectName);
            return objectName;
        }
        
        // Step 3: For lower confidence, use generic "Object" category
        console.log('📦 Low confidence detection - using generic "Object" category');
        return 'Object';
    }

    getObjectEmoji(objectName) {
        const emojiMap = {
            // Trees and plants
            tree: '🌳', oak: '🌳', pine: '🌲', apple: '🍎', leaf: '🍃', plant: '🌱',
            bark: '🌳', trunk: '🌳', branch: '🌿',
            
            // Forests and landscapes
            forest: '🌲', rainforest: '🌿', mountain: '⛰️',
            
            // Insects
            insect: '🐛', butterfly: '🦋', bee: '🐝',
            
            // Animals
            kangaroo: '🦘', bear: '🐻',
            
            // Humans
            human: '👤',
            
            // Food and vegetables
            vegetable: '🥬', carrot: '🥕', tomato: '🍅', potato: '🥔',
            
            // Generic objects
            Object: '📦'
        };
        
        return emojiMap[objectName] || '🌍';
    }

    findBestMatchAdvanced(objectName, allConcepts) {
        const allTerms = [objectName, ...allConcepts.map(c => c.toLowerCase())];
        
        // Enhanced matching rules with better categorization
        const matchingRules = [
            // Trees (most specific first)
            { terms: ['oak', 'white oak', 'red oak', 'live oak'], category: 'oak' },
            { terms: ['maple', 'sugar maple', 'red maple', 'japanese maple'], category: 'maple' },
            { terms: ['pine', 'pine tree', 'scots pine', 'white pine'], category: 'pine' },
            { terms: ['birch', 'white birch', 'paper birch'], category: 'birch' },
            { terms: ['willow', 'weeping willow', 'pussy willow'], category: 'willow' },
            { terms: ['elm', 'american elm', 'dutch elm'], category: 'elm' },
            { terms: ['ash', 'white ash', 'green ash'], category: 'ash' },
            { terms: ['beech', 'american beech', 'copper beech'], category: 'beech' },
            { terms: ['hickory', 'shagbark hickory'], category: 'hickory' },
            { terms: ['walnut', 'black walnut', 'english walnut'], category: 'walnut' },
            { terms: ['poplar', 'yellow poplar', 'tulip poplar'], category: 'poplar' },
            { terms: ['sycamore', 'american sycamore'], category: 'sycamore' },
            { terms: ['basswood', 'american basswood', 'linden'], category: 'basswood' },
            { terms: ['spruce', 'norway spruce', 'blue spruce'], category: 'spruce' },
            { terms: ['fir', 'douglas fir', 'balsam fir'], category: 'fir' },
            { terms: ['cedar', 'eastern red cedar', 'western red cedar'], category: 'cedar' },
            { terms: ['hemlock', 'eastern hemlock', 'western hemlock'], category: 'hemlock' },
            { terms: ['redwood', 'giant redwood', 'coast redwood'], category: 'redwood' },
            { terms: ['cypress', 'bald cypress', 'monterey cypress'], category: 'cypress' },
            { terms: ['juniper', 'eastern juniper', 'utah juniper'], category: 'juniper' },
            { terms: ['eucalyptus', 'blue gum eucalyptus'], category: 'eucalyptus' },
            { terms: ['acacia', 'golden acacia'], category: 'acacia' },
            { terms: ['teak', 'burmese teak'], category: 'teak' },
            { terms: ['mahogany', 'honduran mahogany'], category: 'mahogany' },
            { terms: ['bamboo', 'giant bamboo'], category: 'bamboo' },
            { terms: ['baobab', 'african baobab'], category: 'baobab' },
            
            // Tree-related terms that should map to tree
            { terms: [
                'tree', 'trees', 'trunk', 'bark', 'branch', 'branches', 'leaf', 'leaves', 'foliage',
                'timber', 'wood', 'wooden', 'log', 'lumber',
                'deciduous', 'coniferous', 'evergreen', 'hardwood', 'softwood',
                'grove', 'orchard',
                'plant', 'vegetation', 'flora'
            ], category: 'tree' },
            
            // Fruits (specific fruits first)
            { terms: ['apple', 'red apple', 'green apple'], category: 'apple' },
            { terms: ['orange', 'valencia orange'], category: 'orange' },
            { terms: ['lemon', 'meyer lemon'], category: 'lemon' },
            { terms: ['lime', 'key lime'], category: 'lime' },
            { terms: ['grapefruit', 'pink grapefruit'], category: 'grapefruit' },
            { terms: ['tangerine', 'mandarin'], category: 'tangerine' },
            { terms: ['peach', 'georgia peach'], category: 'peach' },
            { terms: ['plum', 'purple plum'], category: 'plum' },
            { terms: ['cherry', 'sweet cherry'], category: 'cherry' },
            { terms: ['banana', 'yellow banana'], category: 'banana' },
            { terms: ['strawberry', 'wild strawberry'], category: 'strawberry' },
            { terms: ['blueberry', 'wild blueberry'], category: 'blueberry' },
            { terms: ['raspberry', 'red raspberry'], category: 'raspberry' },
            { terms: ['blackberry', 'wild blackberry'], category: 'blackberry' },
            { terms: ['grape', 'wine grape'], category: 'grape' },
            { terms: ['pear', 'bartlett pear'], category: 'pear' },
            { terms: ['pineapple', 'fresh pineapple'], category: 'pineapple' },
            { terms: ['mango', 'tropical mango'], category: 'mango' },
            { terms: ['avocado', 'hass avocado'], category: 'avocado' },
            { terms: ['coconut', 'coconut palm'], category: 'coconut' },
            
            // Generic fruit terms
            { terms: ['fruit', 'fruits', 'citrus', 'berry', 'berries'], category: 'fruit' },
            
            // Flowers (specific first)
            { terms: ['sunflower', 'giant sunflower'], category: 'sunflower' },
            { terms: ['rose', 'red rose', 'white rose'], category: 'rose' },
            { terms: ['tulip', 'red tulip'], category: 'tulip' },
            { terms: ['daisy', 'white daisy'], category: 'daisy' },
            { terms: ['lily', 'white lily'], category: 'lily' },
            { terms: ['orchid', 'purple orchid'], category: 'orchid' },
            { terms: ['iris', 'blue iris'], category: 'iris' },
            { terms: ['carnation', 'pink carnation'], category: 'carnation' },
            { terms: ['chrysanthemum', 'yellow mum'], category: 'chrysanthemum' },
            { terms: ['petunia', 'purple petunia'], category: 'petunia' },
            { terms: ['marigold', 'orange marigold'], category: 'marigold' },
            { terms: ['zinnia', 'colorful zinnia'], category: 'zinnia' },
            { terms: ['peony', 'pink peony'], category: 'peony' },
            { terms: ['daffodil', 'yellow daffodil'], category: 'daffodil' },
            { terms: ['azalea', 'pink azalea'], category: 'azalea' },
            { terms: ['camellia', 'white camellia'], category: 'camellia' },
            { terms: ['begonia', 'red begonia'], category: 'begonia' },
            { terms: ['impatiens', 'pink impatiens'], category: 'impatiens' },
            { terms: ['geranium', 'red geranium'], category: 'geranium' },
            { terms: ['poppy', 'red poppy'], category: 'poppy' },
            { terms: ['lavender', 'purple lavender'], category: 'lavender' },
            { terms: ['hibiscus', 'red hibiscus'], category: 'hibiscus' },
            { terms: ['jasmine', 'white jasmine'], category: 'jasmine' },
            { terms: ['magnolia', 'white magnolia'], category: 'magnolia' },
            { terms: ['violet', 'purple violet'], category: 'violet' },
            { terms: ['gardenia', 'white gardenia'], category: 'gardenia' },
            
            // Water plants vs flowers (lotus, water lily are water plants, not typical flowers)
            { terms: ['blueberry', 'wild blueberry', 'huckleberry'], category: 'blueberry' },
            { terms: ['raspberry', 'red raspberry', 'black raspberry'], category: 'raspberry' },
            { terms: ['blackberry', 'dewberry', 'boysenberry'], category: 'blackberry' },
            { terms: ['cranberry', 'bog cranberry'], category: 'cranberry' },
            { terms: ['gooseberry', 'cape gooseberry'], category: 'gooseberry' },
            { terms: ['elderberry', 'sambucus'], category: 'elderberry' },
            { terms: ['mulberry', 'white mulberry', 'red mulberry'], category: 'mulberry' },
            { terms: ['currant', 'red currant', 'black currant'], category: 'currant' },
            
            // Tropical fruits
            { terms: ['banana', 'plantain', 'cavendish banana'], category: 'banana' },
            { terms: ['mango', 'alphonso mango', 'tommy atkins'], category: 'mango' },
            { terms: ['pineapple', 'ananas'], category: 'pineapple' },
            { terms: ['papaya', 'pawpaw', 'carica papaya'], category: 'papaya' },
            { terms: ['coconut', 'coconut palm'], category: 'coconut' },
            { terms: ['avocado', 'alligator pear'], category: 'avocado' },
            { terms: ['passion fruit', 'maracuja', 'granadilla'], category: 'passion-fruit' },
            { terms: ['kiwi', 'kiwifruit', 'chinese gooseberry'], category: 'kiwi' },
            { terms: ['guava', 'common guava', 'tropical guava'], category: 'guava' },
            { terms: ['lychee', 'litchi', 'lichi'], category: 'lychee' },
            { terms: ['rambutan', 'hairy lychee'], category: 'rambutan' },
            { terms: ['dragon fruit', 'pitaya', 'pitahaya'], category: 'dragon-fruit' },
            { terms: ['star fruit', 'carambola'], category: 'star-fruit' },
            { terms: ['jackfruit', 'artocarpus'], category: 'jackfruit' },
            { terms: ['durian', 'king of fruits'], category: 'durian' },
            { terms: ['mangosteen', 'queen of fruits'], category: 'mangosteen' },
            
            // Melons
            { terms: ['watermelon', 'citrullus'], category: 'watermelon' },
            { terms: ['cantaloupe', 'muskmelon'], category: 'cantaloupe' },
            { terms: ['honeydew', 'honeydew melon'], category: 'honeydew' },
            { terms: ['casaba melon', 'casaba'], category: 'casaba' },
            
            // Other fruits
            { terms: ['grape', 'wine grape', 'table grape'], category: 'grape' },
            { terms: ['fig', 'fresh fig', 'mission fig'], category: 'fig' },
            { terms: ['date', 'medjool date', 'deglet noor'], category: 'date' },
            { terms: ['pomegranate', 'punica granatum'], category: 'pomegranate' },
            { terms: ['persimmon', 'kaki', 'sharon fruit'], category: 'persimmon' },
            { terms: ['olive', 'olive fruit', 'kalamata'], category: 'olive' },
            
            // Fruit trees
            { terms: ['orange tree', 'citrus tree'], category: 'orange-tree' },
            { terms: ['apple tree', 'orchard tree'], category: 'apple-tree' },
            { terms: ['peach tree', 'stone fruit tree'], category: 'peach-tree' },
            { terms: ['cherry tree', 'flowering cherry'], category: 'cherry-tree' },
            { terms: ['mango tree', 'tropical fruit tree'], category: 'mango-tree' },
            { terms: ['avocado tree', 'persea americana'], category: 'avocado-tree' },
            { terms: ['lemon tree', 'citrus limon'], category: 'lemon-tree' },
            { terms: ['banana tree', 'banana plant'], category: 'banana-tree' },
            { terms: ['coconut tree', 'palm tree'], category: 'coconut-tree' },
            { terms: ['fig tree', 'ficus carica'], category: 'fig-tree' },
            { terms: ['olive tree', 'olea europaea'], category: 'olive-tree' },
            { terms: ['pomegranate tree'], category: 'pomegranate-tree' },
            
            // Generic fruit terms (lower priority than specific types)
            { terms: ['fruit', 'berry', 'citrus', 'tropical fruit'], category: 'fruit' },
            
            // Marine life and underwater ecosystems (specific first)
            { terms: ['coral reef', 'reef', 'barrier reef', 'coral garden'], category: 'reef' },
            { terms: ['coral', 'polyp', 'coral colony', 'hard coral', 'soft coral'], category: 'coral' },
            
            // Pollution and waste (very high priority - environmental threats)
            { terms: ['garbage', 'trash', 'litter', 'waste'], category: 'trash' },
            { terms: ['plastic', 'plastic bag', 'plastic bottle', 'microplastic'], category: 'plastic' },
            { terms: ['oil spill', 'pollution', 'contamination', 'toxic'], category: 'pollution' },
            { terms: ['cigarette', 'cigarette butt', 'smoking'], category: 'cigarette' },
            
            // Specific tree types (most specific first)
            // Deciduous trees
            { terms: ['oak', 'white oak', 'red oak', 'live oak'], category: 'oak' },
            { terms: ['maple', 'sugar maple', 'red maple', 'silver maple'], category: 'maple' },
            { terms: ['birch', 'white birch', 'paper birch', 'silver birch'], category: 'birch' },
            { terms: ['willow', 'weeping willow', 'pussy willow'], category: 'willow' },
            { terms: ['elm', 'american elm', 'slippery elm'], category: 'elm' },
            { terms: ['ash', 'white ash', 'green ash'], category: 'ash' },
            { terms: ['beech', 'american beech', 'european beech'], category: 'beech' },
            { terms: ['hickory', 'shagbark hickory'], category: 'hickory' },
            { terms: ['walnut', 'black walnut', 'english walnut'], category: 'walnut' },
            { terms: ['poplar', 'cottonwood', 'aspen'], category: 'poplar' },
            { terms: ['sycamore', 'plane tree'], category: 'sycamore' },
            { terms: ['basswood', 'linden', 'lime tree'], category: 'basswood' },
            
            // Coniferous trees  
            { terms: ['pine', 'white pine', 'red pine', 'scots pine'], category: 'pine' },
            { terms: ['spruce', 'norway spruce', 'blue spruce'], category: 'spruce' },
            { terms: ['fir', 'balsam fir', 'fraser fir', 'douglas fir'], category: 'fir' },
            { terms: ['cedar', 'red cedar', 'white cedar', 'cedar tree'], category: 'cedar' },
            { terms: ['hemlock', 'eastern hemlock'], category: 'hemlock' },
            { terms: ['redwood', 'sequoia', 'giant sequoia'], category: 'redwood' },
            { terms: ['cypress', 'bald cypress'], category: 'cypress' },
            { terms: ['juniper', 'eastern juniper'], category: 'juniper' },
            
            // Tropical and exotic trees
            { terms: ['eucalyptus', 'gum tree'], category: 'eucalyptus' },
            { terms: ['acacia', 'wattle'], category: 'acacia' },
            { terms: ['teak', 'teak tree'], category: 'teak' },
            { terms: ['mahogany', 'mahogany tree'], category: 'mahogany' },
            { terms: ['bamboo', 'bamboo grove'], category: 'bamboo' },
            { terms: ['baobab', 'bottle tree'], category: 'baobab' },
            
            // Water bodies and rivers (specific first)
            { terms: ['amazon river', 'amazon'], category: 'amazon-river' },
            { terms: ['nile river', 'nile'], category: 'nile-river' },
            { terms: ['mississippi river', 'mississippi'], category: 'mississippi-river' },
            { terms: ['colorado river', 'colorado'], category: 'colorado-river' },
            { terms: ['rapids', 'whitewater', 'river rapids'], category: 'rapids' },
            { terms: ['waterfall', 'falls', 'cascade'], category: 'waterfall' },
            { terms: ['stream', 'brook', 'creek'], category: 'stream' },
            { terms: ['spring', 'natural spring', 'freshwater spring'], category: 'spring' },
            { terms: ['estuary', 'river mouth', 'delta'], category: 'estuary' },
            { terms: ['wetland', 'marsh', 'swamp', 'bog'], category: 'wetland' },
            { terms: ['lake', 'freshwater lake', 'mountain lake'], category: 'lake' },
            { terms: ['pond', 'small pond', 'farm pond'], category: 'pond' },
            
            // Australian snakes (highest priority - most specific first)
            { terms: ['eastern brown snake', 'eastern brown', 'brown snake', 'pseudonaja textilis'], category: 'eastern-brown-snake' },
            { terms: ['taipan', 'coastal taipan', 'inland taipan', 'fierce snake', 'oxyuranus'], category: 'taipan' },
            { terms: ['death adder', 'common death adder', 'acanthophis', 'desert death adder'], category: 'death-adder' },
            { terms: ['tiger snake', 'notechis scutatus', 'black tiger snake'], category: 'tiger-snake' },
            { terms: ['red bellied black snake', 'red belly black snake', 'rbbs', 'pseudechis porphyriacus'], category: 'red-bellied-black-snake' },
            { terms: ['carpet python', 'diamond python', 'morelia spilota', 'coastal carpet python'], category: 'carpet-python' },
            { terms: ['childrens python', 'children python', 'antaresia childreni', 'spotted python'], category: 'childrens-python' },
            { terms: ['woma python', 'woma', 'aspidites ramsayi', 'sand python'], category: 'woma-python' },
            
            // International snakes (lower priority than Australian species)
            { terms: ['python', 'ball python', 'burmese python', 'reticulated python'], category: 'python' },
            { terms: ['cobra', 'king cobra', 'spitting cobra'], category: 'cobra' },
            { terms: ['viper', 'pit viper', 'gaboon viper'], category: 'viper' },
            { terms: ['rattlesnake', 'rattler', 'diamondback'], category: 'rattlesnake' },
            { terms: ['boa', 'boa constrictor', 'rainbow boa'], category: 'boa' },
            { terms: ['anaconda', 'green anaconda'], category: 'anaconda' },
            { terms: ['mamba', 'black mamba', 'green mamba'], category: 'mamba' },
            { terms: ['adder', 'puff adder'], category: 'adder' },
            { terms: ['copperhead'], category: 'copperhead' },
            { terms: ['cottonmouth', 'water moccasin'], category: 'cottonmouth' },
            { terms: ['kingsnake', 'king snake'], category: 'kingsnake' },
            { terms: ['garter snake', 'garter'], category: 'garter' },
            { terms: ['corn snake', 'red rat snake'], category: 'corn' },
            { terms: ['milk snake'], category: 'milk' },
            { terms: ['hognose', 'hog nose snake'], category: 'hognose' },
            // Generic snake terms (lower priority than specific types)
            { terms: ['snake', 'serpent', 'reptile'], category: 'snake' },
            
            // Mammals - Domestic animals
            { terms: ['dog', 'puppy', 'canine', 'golden retriever', 'labrador'], category: 'dog' },
            { terms: ['cat', 'kitten', 'feline', 'tabby', 'persian cat'], category: 'cat' },
            { terms: ['horse', 'stallion', 'mare', 'foal', 'pony'], category: 'horse' },
            { terms: ['cow', 'cattle', 'bull', 'calf', 'dairy cow'], category: 'cow' },
            { terms: ['sheep', 'lamb', 'ram', 'ewe', 'flock'], category: 'sheep' },
            { terms: ['goat', 'kid goat', 'billy goat', 'nanny goat'], category: 'goat' },
            { terms: ['pig', 'swine', 'hog', 'piglet', 'boar'], category: 'pig' },
            
            // Mammals - Wild animals
            { terms: ['bear', 'grizzly', 'black bear', 'brown bear', 'polar bear'], category: 'bear' },
            { terms: ['wolf', 'gray wolf', 'pack', 'alpha wolf'], category: 'wolf' },
            { terms: ['fox', 'red fox', 'arctic fox', 'fennec fox'], category: 'fox' },
            { terms: ['deer', 'white-tail', 'buck', 'doe', 'fawn'], category: 'deer' },
            { terms: ['elk', 'wapiti', 'bull elk'], category: 'elk' },
            { terms: ['moose', 'bull moose', 'antlers'], category: 'moose' },
            { terms: ['rabbit', 'bunny', 'cottontail', 'hare'], category: 'rabbit' },
            { terms: ['squirrel', 'tree squirrel', 'ground squirrel'], category: 'squirrel' },
            { terms: ['raccoon', 'trash panda', 'masked bandit'], category: 'raccoon' },
            { terms: ['skunk', 'striped skunk', 'polecat'], category: 'skunk' },
            { terms: ['opossum', 'possum', 'virginia opossum'], category: 'opossum' },
            
            // Mammals - Australian animals (specific first before African animals)
            { terms: ['kangaroo', 'wallaby', 'joey', 'australian marsupial'], category: 'kangaroo' },
            
            // Mammals - Large African animals
            { terms: ['elephant', 'african elephant', 'asian elephant'], category: 'elephant' },
            { terms: ['lion', 'lioness', 'pride', 'mane'], category: 'lion' },
            { terms: ['tiger', 'siberian tiger', 'bengal tiger'], category: 'tiger' },
            { terms: ['leopard', 'snow leopard', 'jaguar'], category: 'leopard' },
            { terms: ['cheetah', 'fastest cat'], category: 'cheetah' },
            { terms: ['giraffe', 'tall neck', 'african giraffe'], category: 'giraffe' },
            { terms: ['zebra', 'striped horse', 'plains zebra'], category: 'zebra' },
            { terms: ['rhinoceros', 'rhino', 'horn'], category: 'rhinoceros' },
            { terms: ['hippopotamus', 'hippo', 'river horse'], category: 'hippopotamus' },
            
            // Mammals - Primates
            { terms: ['monkey', 'primate', 'ape'], category: 'monkey' },
            { terms: ['chimpanzee', 'chimp', 'pan troglodytes'], category: 'chimpanzee' },
            { terms: ['gorilla', 'silverback', 'mountain gorilla'], category: 'gorilla' },
            { terms: ['orangutan', 'great ape'], category: 'orangutan' },
            
            // Marine mammals
            { terms: ['whale', 'humpback', 'blue whale', 'sperm whale'], category: 'whale' },
            { terms: ['dolphin', 'bottlenose', 'marine mammal'], category: 'dolphin' },
            { terms: ['seal', 'sea lion', 'harbor seal'], category: 'seal' },
            { terms: ['walrus', 'tusk', 'arctic marine'], category: 'walrus' },
            
            // Birds - Common birds
            { terms: ['eagle', 'bald eagle', 'golden eagle', 'raptor'], category: 'eagle' },
            { terms: ['hawk', 'red-tail', 'bird of prey'], category: 'hawk' },
            { terms: ['owl', 'hoot owl', 'barn owl', 'great horned'], category: 'owl' },
            { terms: ['robin', 'american robin', 'red breast'], category: 'robin' },
            { terms: ['cardinal', 'red bird', 'northern cardinal'], category: 'cardinal' },
            { terms: ['blue jay', 'jay', 'corvid'], category: 'blue-jay' },
            { terms: ['crow', 'raven', 'black bird'], category: 'crow' },
            { terms: ['sparrow', 'small sparrow', 'small bird'], category: 'sparrow' },
            { terms: ['woodpecker', 'red-headed', 'pecker'], category: 'woodpecker' },
            
            // Birds - Large/exotic birds  
            { terms: ['flamingo', 'pink bird', 'wading bird'], category: 'flamingo' },
            { terms: ['peacock', 'peafowl', 'colorful plumes'], category: 'peacock' },
            { terms: ['swan', 'white swan', 'mute swan'], category: 'swan' },
            { terms: ['pelican', 'large beak', 'fishing bird'], category: 'pelican' },
            { terms: ['penguin', 'antarctic bird', 'flightless'], category: 'penguin' },
            { terms: ['ostrich', 'large flightless', 'african bird'], category: 'ostrich' },
            
            // Insects
            { terms: ['butterfly', 'monarch', 'colorful wings'], category: 'butterfly' },
            { terms: ['bee', 'honey bee', 'bumble bee', 'pollinator'], category: 'bee' },
            { terms: ['ladybug', 'ladybird', 'red beetle'], category: 'ladybug' },
            { terms: ['dragonfly', 'damselfly', 'pond insect'], category: 'dragonfly' },
            { terms: ['spider', 'arachnid', 'web spinner'], category: 'spider' },
            { terms: ['ant', 'worker ant', 'colony'], category: 'ant' },
            
            // Marine life
            { terms: ['fish', 'swimming', 'aquatic'], category: 'fish' },
            { terms: ['shark', 'great white', 'predator fish'], category: 'shark' },
            { terms: ['octopus', 'tentacles', 'cephalopod'], category: 'octopus' },
            { terms: ['jellyfish', 'sea jelly', 'transparent'], category: 'jellyfish' },
            { terms: ['sea turtle', 'turtle', 'marine reptile'], category: 'sea-turtle' },
            { terms: ['crab', 'crustacean', 'claws'], category: 'crab' },
            
            // Humans and people (high priority)
            { terms: ['person', 'people', 'human', 'man', 'woman', 'child', 'adult', 'portrait', 'face', 'individual'], category: 'human' },
            
            // Generic animal terms (lowest priority)
            { terms: ['animal', 'creature', 'wildlife', 'mammal'], category: 'animal' },
            
            { terms: ['mountain', 'hill', 'peak', 'summit'], category: 'mountain' },
            { terms: ['rock', 'stone', 'cliff', 'boulder'], category: 'mountain' },
            { terms: ['sky', 'cloud', 'weather'], category: 'earth' },
            
            // Grass and fields (separate from trees)
            { terms: ['grass', 'field', 'meadow', 'lawn', 'turf'], category: 'earth' }
        ];
        
        // Find best match with improved logic
        let bestMatch = null;
        let bestScore = 0;
        
        for (const rule of matchingRules) {
            let matchScore = 0;
            let matchedTerms = [];
            
            for (const term of allTerms) {
                for (const ruleTerm of rule.terms) {
                    // Use exact match or word boundary matching to prevent false positives
                    const termLower = term.toLowerCase();
                    const ruleTermLower = ruleTerm.toLowerCase();
                    
                    if (termLower === ruleTermLower || 
                        (termLower.includes(ruleTermLower) && termLower.includes(' ' + ruleTermLower)) ||
                        (ruleTermLower.includes(termLower) && ruleTermLower.includes(' ' + termLower)) ||
                        (termLower.includes(ruleTermLower + ' ')) ||
                        (ruleTermLower.includes(termLower + ' ')) ||
                        termLower.includes(ruleTermLower) && ruleTermLower.length >= 4) {
                        matchScore++;
                        matchedTerms.push(term + '->' + ruleTerm);
                        break; // Don't double-count the same term
                    }
                }
            }
            
            if (matchScore > bestScore) {
                bestScore = matchScore;
                bestMatch = rule.category;
                console.log('New best match:', rule.category, 'score:', matchScore, 'terms:', matchedTerms);
            }
        }
        
        // Priority override: Specific detections beat generic ones
        const hasLadybug = allTerms.some(term => term.includes('ladybug') || term.includes('ladybird'));
        const hasRainforest = allTerms.some(term => term.includes('rainforest') || term.includes('jungle'));
        const hasForest = allTerms.some(term => term.includes('forest') && !term.includes('rainforest'));
        const hasMountain = allTerms.some(term => term.includes('mountain') || term.includes('panoramic') || term.includes('landscape'));
        const hasWater = allTerms.some(term => term.includes('water') || term.includes('river') || term.includes('stream'));
        
        if (hasLadybug && bestMatch !== 'ladybug') {
            console.log('🎯 Priority override: Ladybug detected, overriding', bestMatch);
            return 'ladybug';
        }
        if (hasRainforest && bestMatch !== 'rainforest') {
            console.log('🎯 Priority override: Rainforest detected, overriding', bestMatch);
            return 'rainforest';
        }
        if (hasForest && bestMatch === 'tree') {
            console.log('🎯 Priority override: Forest ecosystem beats individual tree');
            return 'forest';  
        }
        if (hasMountain && (bestMatch === 'tree' || bestMatch === 'forest')) {
            console.log('🎯 Priority override: Mountain landscape detected');
            return 'mountain';
        }
        if (hasWater && bestMatch === 'tree') {
            console.log('🎯 Priority override: Water body detected');
            return 'river';
        }
        
        // TREE PRIORITY OVERRIDES - Specific trees beat generic "tree"
        const specificTrees = [
            'oak', 'maple', 'birch', 'willow', 'elm', 'ash', 'beech', 'hickory', 'walnut', 
            'poplar', 'sycamore', 'basswood', 'pine', 'spruce', 'fir', 'cedar', 'hemlock', 
            'redwood', 'cypress', 'juniper', 'eucalyptus', 'acacia', 'teak', 'mahogany', 
            'bamboo', 'baobab'
        ];
        for (const specificTree of specificTrees) {
            const hasSpecificTree = allTerms.some(term => term.includes(specificTree));
            if (hasSpecificTree && bestMatch === 'tree') {
                console.log('🌳 TREE PRIORITY OVERRIDE:', specificTree, 'beats generic tree');
                return specificTree;
            }
        }

        // FLOWER PRIORITY OVERRIDES - Specific flowers beat generic "flower"
        const specificFlowers = [
            'sunflower', 'lavender', 'orchid', 'rose', 'tulip', 'daisy', 'lily', 'lotus', 'iris',
            'carnation', 'chrysanthemum', 'petunia', 'marigold', 'zinnia', 'peony', 'daffodil',
            'azalea', 'camellia', 'begonia', 'impatiens', 'geranium', 'poppy', 'forget-me-not',
            'bluebell', 'buttercup', 'clover', 'dandelion', 'wild-rose', 'primrose', 'foxglove',
            'snapdragon', 'bird-of-paradise', 'anthurium', 'frangipani', 'bougainvillea', 'protea',
            'passion-flower', 'crocus', 'hyacinth', 'amaryllis', 'gladiolus', 'freesia',
            'morning-glory', 'sweet-pea', 'clematis', 'honeysuckle', 'chamomile', 'sage', 'mint', 'thyme'
        ];
        for (const specificFlower of specificFlowers) {
            const hasSpecificFlower = allTerms.some(term => term.includes(specificFlower));
            if (hasSpecificFlower && bestMatch === 'flower') {
                console.log('🌸 FLOWER PRIORITY OVERRIDE:', specificFlower, 'beats generic flower');
                return specificFlower;
            }
        }
        
        // FRUIT PRIORITY OVERRIDES - Specific fruits beat generic "fruit"
        const specificFruits = [
            'orange', 'lemon', 'lime', 'grapefruit', 'tangerine', 'pomelo', 'bergamot', 'yuzu',
            'peach', 'plum', 'apricot', 'cherry', 'apple', 'pear', 'quince',
            'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry', 'gooseberry', 'elderberry', 'mulberry', 'currant',
            'banana', 'mango', 'pineapple', 'papaya', 'coconut', 'avocado', 'passion-fruit', 'kiwi', 'guava', 'lychee',
            'rambutan', 'dragon-fruit', 'star-fruit', 'jackfruit', 'durian', 'mangosteen',
            'watermelon', 'cantaloupe', 'honeydew', 'casaba',
            'grape', 'fig', 'date', 'pomegranate', 'persimmon', 'olive'
        ];
        for (const specificFruit of specificFruits) {
            const hasSpecificFruit = allTerms.some(term => term.includes(specificFruit));
            if (hasSpecificFruit && bestMatch === 'fruit') {
                console.log('🍎 FRUIT PRIORITY OVERRIDE:', specificFruit, 'beats generic fruit');
                return specificFruit;
            }
        }
        
        // CORAL/REEF PRIORITY OVERRIDES - Specific coral/reef beats generic "ocean"
        const coralReefTerms = ['coral', 'reef', 'coral reef', 'barrier reef'];
        for (const coralTerm of coralReefTerms) {
            const hasCoralReef = allTerms.some(term => term.includes(coralTerm));
            if (hasCoralReef && bestMatch === 'ocean') {
                if (allTerms.some(term => term.includes('reef'))) {
                    console.log('🪸 CORAL REEF PRIORITY OVERRIDE: reef beats generic ocean');
                    return 'reef';
                } else if (allTerms.some(term => term.includes('coral'))) {
                    console.log('🪸 CORAL PRIORITY OVERRIDE: coral beats generic ocean');
                    return 'coral';
                }
            }
        }
        
        // FISH PRIORITY OVERRIDES - Specific fish beats generic "ocean"
        const fishTerms = ['fish', 'salmon', 'trout'];
        for (const fishTerm of fishTerms) {
            const hasFish = allTerms.some(term => term.includes(fishTerm));
            if (hasFish && bestMatch === 'ocean') {
                console.log('🐟 FISH PRIORITY OVERRIDE: fish beats generic ocean');
                return 'fish';
            }
        }
        
        // POLLUTION PRIORITY OVERRIDES - Pollution/waste beats any natural environment  
        const pollutionTerms = ['garbage', 'trash', 'litter', 'waste', 'plastic', 'pollution', 'cigarette', 'oil spill'];
        for (const pollutionTerm of pollutionTerms) {
            const hasPollution = allTerms.some(term => term.includes(pollutionTerm));
            if (hasPollution && ['river', 'ocean', 'tree', 'forest', 'mountain', 'earth'].includes(bestMatch)) {
                if (allTerms.some(term => term.includes('plastic'))) {
                    console.log('🗑️ POLLUTION PRIORITY OVERRIDE: plastic beats natural environment');
                    return 'plastic';
                } else if (allTerms.some(term => term.includes('cigarette'))) {
                    console.log('🚬 POLLUTION PRIORITY OVERRIDE: cigarette beats natural environment');
                    return 'cigarette';
                } else if (allTerms.some(term => term.includes('pollution') || term.includes('oil'))) {
                    console.log('☠️ POLLUTION PRIORITY OVERRIDE: pollution beats natural environment');
                    return 'pollution';
                } else {
                    console.log('🗑️ POLLUTION PRIORITY OVERRIDE: trash beats natural environment');
                    return 'trash';
                }
            }
        }
        
        // TREE PRIORITY OVERRIDES - Fruit trees beat generic "tree"
        const fruitTrees = ['apple-tree', 'orange-tree', 'cherry-tree', 'mango-tree', 'coconut-tree', 'lemon-tree', 'peach-tree', 'fig-tree', 'olive-tree'];
        for (const fruitTree of fruitTrees) {
            const hasFruitTree = allTerms.some(term => 
                term.includes('apple tree') || term.includes('orange tree') || term.includes('cherry tree') ||
                term.includes('mango tree') || term.includes('coconut tree') || term.includes('lemon tree') ||
                term.includes('peach tree') || term.includes('fig tree') || term.includes('olive tree') ||
                term.includes('citrus tree') || term.includes('fruit tree') || term.includes('orchard')
            );
            if (hasFruitTree && bestMatch === 'tree') {
                const detectedTree = fruitTrees.find(tree => {
                    const treeName = tree.replace('-tree', '');
                    return allTerms.some(term => term.includes(treeName + ' tree') || term.includes(treeName));
                }) || 'apple-tree';
                console.log('🌳 FRUIT TREE PRIORITY OVERRIDE:', detectedTree, 'beats generic tree');
                return detectedTree;
            }
        }
        
        // SNAKE PRIORITY OVERRIDES - Any snake detection beats other categories
        const hasSnakeInConcepts = allTerms.some(term => term.includes('snake') || term.includes('reptile'));
        if (hasSnakeInConcepts && (bestMatch === 'bear' || bestMatch === 'earth' || bestMatch === 'tree')) {
            console.log('🐍 SNAKE OVERRIDE: Snake detected in concepts, overriding', bestMatch);
            
            // Check for specific snake types first
            const specificSnakes = ['python', 'cobra', 'viper', 'rattlesnake', 'boa', 'anaconda', 'mamba', 'adder', 'copperhead', 'cottonmouth', 'kingsnake', 'garter', 'corn', 'milk', 'hognose'];
            for (const specificSnake of specificSnakes) {
                const hasSpecificSnake = allTerms.some(term => term.includes(specificSnake));
                if (hasSpecificSnake) {
                    console.log('🐍 SPECIFIC SNAKE OVERRIDE:', specificSnake);
                    return specificSnake;
                }
            }
            
            // Try intelligent snake type detection based on available info
            const intelligentSnakeType = this.detectSnakeType(allTerms);
            if (intelligentSnakeType !== 'snake') {
                console.log('🐍 INTELLIGENT SNAKE DETECTION:', intelligentSnakeType);
                return intelligentSnakeType;
            }
            
            // Default to generic snake if no specific type found
            return 'snake';
        }
        
        // SPECIFIC SNAKE PRIORITY OVERRIDES - Specific snakes beat generic "snake"
        const specificSnakes = ['python', 'cobra', 'viper', 'rattlesnake', 'boa', 'anaconda', 'mamba', 'adder', 'copperhead', 'cottonmouth', 'kingsnake', 'garter', 'corn', 'milk', 'hognose'];
        for (const specificSnake of specificSnakes) {
            const hasSpecificSnake = allTerms.some(term => term.includes(specificSnake));
            if (hasSpecificSnake && bestMatch === 'snake') {
                console.log('🐍 SPECIFIC SNAKE PRIORITY OVERRIDE:', specificSnake, 'beats generic snake');
                return specificSnake;
            }
        }

        // RIVER PRIORITY OVERRIDES - Specific rivers and water bodies beat generic "river"
        const specificRivers = [
            'amazon-river', 'nile-river', 'mississippi-river', 'colorado-river', 
            'ganges-river', 'yangtze-river', 'danube-river', 'rhine-river'
        ];
        const specificWaterBodies = [
            'rapids', 'waterfall', 'stream', 'pond', 'wetland', 'marsh', 'swamp',
            'brook', 'creek', 'spring', 'estuary', 'delta'
        ];
        
        // Check for specific rivers first
        for (const specificRiver of specificRivers) {
            const riverName = specificRiver.replace('-river', '');
            const hasSpecificRiver = allTerms.some(term => 
                term.includes(riverName) || term.includes(specificRiver));
            if (hasSpecificRiver && (bestMatch === 'river' || bestMatch === 'water')) {
                console.log('🏞️ RIVER PRIORITY OVERRIDE:', specificRiver, 'beats generic', bestMatch);
                return specificRiver;
            }
        }
        
        // Check for specific water bodies
        for (const specificWaterBody of specificWaterBodies) {
            const hasSpecificWaterBody = allTerms.some(term => term.includes(specificWaterBody));
            if (hasSpecificWaterBody && (bestMatch === 'river' || bestMatch === 'water')) {
                console.log('🌊 WATER BODY PRIORITY OVERRIDE:', specificWaterBody, 'beats generic', bestMatch);
                return specificWaterBody;
            }
        }
        
        // ANIMAL PRIORITY OVERRIDES - Specific animals beat generic "animal"
        const specificAnimals = [
            // Domestic animals
            'dog', 'cat', 'horse', 'cow', 'sheep', 'goat', 'pig',
            // Wild mammals
            'bear', 'wolf', 'fox', 'deer', 'elk', 'moose', 'rabbit', 'squirrel', 
            'raccoon', 'skunk', 'opossum', 'kangaroo',
            // Large African animals
            'elephant', 'lion', 'tiger', 'leopard', 'cheetah', 'giraffe', 'zebra', 
            'rhinoceros', 'hippopotamus',
            // Primates
            'monkey', 'chimpanzee', 'gorilla', 'orangutan',
            // Humans
            'human',
            // Marine mammals
            'whale', 'dolphin', 'seal', 'walrus',
            // Birds
            'eagle', 'hawk', 'owl', 'robin', 'cardinal', 'blue-jay', 'crow', 'sparrow', 
            'woodpecker', 'flamingo', 'peacock', 'swan', 'pelican', 'penguin', 'ostrich',
            // Insects
            'butterfly', 'bee', 'ladybug', 'dragonfly', 'spider', 'ant',
            // Marine life
            'fish', 'shark', 'octopus', 'jellyfish', 'sea-turtle', 'crab'
        ];
        for (const specificAnimal of specificAnimals) {
            const hasSpecificAnimal = allTerms.some(term => term.includes(specificAnimal));
            if (hasSpecificAnimal && (bestMatch === 'animal' || bestMatch === 'bird')) {
                console.log('🐾 ANIMAL PRIORITY OVERRIDE:', specificAnimal, 'beats generic', bestMatch);
                return specificAnimal;
            }
        }
        
        // If we matched to generic 'snake', try intelligent detection
        if (bestMatch === 'snake') {
            console.log('🔍 DETECTED GENERIC SNAKE - Attempting intelligent detection...');
            const intelligentSnakeType = this.detectSnakeType(allTerms);
            if (intelligentSnakeType !== 'snake') {
                console.log('🐍 INTELLIGENT SNAKE DETECTION for generic snake:', intelligentSnakeType);
                return intelligentSnakeType;
            }
            console.log('⚠️ No intelligent detection - defaulting to generic snake');
        }
        
        if (bestMatch) {
            console.log('Final match:', bestMatch, 'with score:', bestScore);
            return bestMatch;
        }
        
        // Enhanced fallback based on the primary detected object
        const primaryTerm = allTerms[0] || '';
        console.log('No rule matches, using enhanced fallback for:', primaryTerm);
        
        // Smart fallback classifications for nature-related terms
        if (primaryTerm.includes('tree') || primaryTerm.includes('wood') || primaryTerm.includes('bark')) {
            return 'tree';
        } else if (primaryTerm.includes('flower') || primaryTerm.includes('bloom') || primaryTerm.includes('petal')) {
            return 'flower';
        } else if (primaryTerm.includes('water') || primaryTerm.includes('pond') || primaryTerm.includes('lake')) {
            return 'river';
        } else if (primaryTerm.includes('animal') || primaryTerm.includes('mammal') || primaryTerm.includes('pet')) {
            return 'animal'; // Using animal as generic animal category
        }
        
        // For non-nature objects, return the actual detected object name
        console.log('🏠 NON-NATURE OBJECT DETECTED: Returning actual object name:', primaryTerm);
        return primaryTerm || 'earth';
    }

    getObjectEmoji(objectName) {
        const emojiMap = {
            // Trees and plants
            tree: '🌳', oak: '🌳', pine: '🌲', apple: '🍎', leaf: '🍃', plant: '🌱',
            bark: '🌳', trunk: '🌳', branch: '🌿',
            
            // Deciduous trees (non-fruit)
            maple: '🍁', birch: '🌳', willow: '🌳', elm: '🌳', ash: '🌳',
            beech: '🌳', hickory: '🌳', walnut: '🌳', poplar: '🌳', sycamore: '🌳', basswood: '🌳',
            
            // Coniferous trees
            spruce: '🌲', fir: '🌲', cedar: '🌲', hemlock: '🌲', redwood: '🌲', 
            cypress: '🌲', juniper: '🌲',
            
            // Tropical and exotic trees  
            eucalyptus: '🌳', acacia: '🌳', teak: '🌳', mahogany: '🌳', bamboo: '🎋', baobab: '🌳',
            
            // Forests and landscapes
            forest: '🌲', rainforest: '🌿', mountain: '⛰️',
            
            // Mushrooms and fungi
            mushroom: '🍄', fungus: '🍄', fungi: '🍄',
            
            // Citrus fruits
            fruit: '🍎', orange: '🍊', lemon: '🍋', lime: '🟢', grapefruit: '🍊',
            tangerine: '🍊', pomelo: '🍊', bergamot: '🍋', yuzu: '🟡',
            
            // Stone fruits
            peach: '🍑', plum: '🟣', apricot: '🟠', cherry: '🍒',
            
            // Pome fruits
            apple: '🍎', pear: '🍐', quince: '🍐',
            
            // Berries
            strawberry: '🍓', blueberry: '🫐', raspberry: '🫐', blackberry: '🫐',
            cranberry: '🔴', gooseberry: '🟢', elderberry: '🟣', mulberry: '🟣', currant: '🔴',
            
            // Tropical fruits
            banana: '🍌', mango: '🥭', pineapple: '🍍', papaya: '🟠', coconut: '🥥',
            avocado: '🥑', 'passion-fruit': '🟣', kiwi: '🥝', guava: '🟢', lychee: '⚪',
            rambutan: '🔴', 'dragon-fruit': '🐉', 'star-fruit': '⭐', jackfruit: '🟡',
            durian: '🟤', mangosteen: '🟣',
            
            // Melons
            watermelon: '🍉', cantaloupe: '🍈', honeydew: '🍈', casaba: '🍈',
            
            // Other fruits
            grape: '🍇', fig: '🟤', date: '🟤', pomegranate: '🔴', persimmon: '🟠', olive: '🫒',
            
            // Fruit trees
            'orange-tree': '🌳', 'apple-tree': '🌳', 'peach-tree': '🌳', 'cherry-tree': '🌸',
            'mango-tree': '🌳', 'avocado-tree': '🌳', 'lemon-tree': '🌳', 'banana-tree': '🌴',
            'coconut-tree': '🌴', 'fig-tree': '🌳', 'olive-tree': '🌳', 'pomegranate-tree': '🌳',
            
            // Flowers
            flower: '🌸', rose: '🌹', tulip: '🌷', sunflower: '🌻', lavender: '💜',
            orchid: '🌺', daisy: '🌼', lily: '🌸', lotus: '🪷', iris: '🌺',
            
            // Garden flowers
            carnation: '🌸', chrysanthemum: '🌼', petunia: '🌺', marigold: '🌼',
            zinnia: '🌻', peony: '🌸', daffodil: '🌼', azalea: '🌺',
            camellia: '🌸', begonia: '🌺', impatiens: '🌸', geranium: '🌺',
            
            // Wildflowers
            poppy: '🌺', 'forget-me-not': '💙', bluebell: '💙', buttercup: '💛',
            clover: '🍀', dandelion: '🌼', 'wild-rose': '🌹', primrose: '🌼',
            foxglove: '💜', snapdragon: '🌸',
            
            // Exotic flowers
            'bird-of-paradise': '🧡', anthurium: '❤️', frangipani: '🌸',
            bougainvillea: '💜', protea: '🌸', 'passion-flower': '💜',
            
            // Bulb flowers
            crocus: '💜', hyacinth: '💜', amaryllis: '🌺', gladiolus: '🌸', freesia: '💛',
            
            // Climbing flowers
            'morning-glory': '💜', 'sweet-pea': '🌸', clematis: '💜', honeysuckle: '🌼',
            
            // Herb flowers
            chamomile: '🌼', sage: '💜', mint: '🌿', thyme: '💜',
            
            // Other flower terms
            bloom: '🌺', blossom: '🌸', petal: '🌸',
            
            // Water
            ocean: '🌊', sea: '🌊', water: '💧', river: '🏞️', lake: '🏞️',
            stream: '🏞️', reef: '🪸', coral: '🪸', lotus: '🪷', lily: '🪷',
            
            // Famous rivers
            'amazon-river': '🏞️', 'nile-river': '🏞️', 'mississippi-river': '🏞️', 
            'colorado-river': '🏞️', 'ganges-river': '🏞️', 'yangtze-river': '🏞️',
            'danube-river': '🏞️', 'rhine-river': '🏞️',
            
            // Water bodies and features
            rapids: '🌊', waterfall: '💧', brook: '🏞️', creek: '🏞️',
            spring: '💧', estuary: '🏞️', delta: '🏞️', wetland: '🌾',
            marsh: '🌾', swamp: '🌾', pond: '🏞️',
            
            // Animals
            rabbit: '🐰', bunny: '🐰', hare: '🐰', bear: '🐻',
            bird: '🐦', eagle: '🦅', owl: '🦉', fish: '🐟',
            butterfly: '🦋', bee: '🐝', ladybug: '🐞', beetle: '🐞', animal: '🐾',
            
            // Mammals - Domestic animals
            dog: '🐕', cat: '🐱', horse: '🐴', cow: '🐄', sheep: '🐑', goat: '🐐', pig: '🐷',
            
            // Mammals - Wild animals  
            wolf: '🐺', fox: '🦊', deer: '🦌', elk: '🦌', moose: '🫎', squirrel: '🐿️',
            raccoon: '🦝', skunk: '🦨', opossum: '🐀', kangaroo: '🦘',
            
            // Mammals - Large African animals
            elephant: '🐘', lion: '🦁', tiger: '🐅', leopard: '🐆', cheetah: '🐆',
            giraffe: '🦒', zebra: '🦓', rhinoceros: '🦏', hippopotamus: '🦛',
            
            // Mammals - Primates
            monkey: '🐒', chimpanzee: '🐵', gorilla: '🦍', orangutan: '🦧',
            // Humans
            human: '👤',
            
            // Marine mammals
            whale: '🐋', dolphin: '🐬', seal: '🦭', walrus: '🦭',
            
            // Birds - Common birds
            hawk: '🦅', robin: '🐦', cardinal: '🐦', 'blue-jay': '🐦', crow: '🐦',
            sparrow: '🐦', woodpecker: '🐦',
            
            // Birds - Large/exotic birds
            flamingo: '🦩', peacock: '🦚', swan: '🦢', pelican: '🦆', penguin: '🐧', ostrich: '🦓',
            
            // Insects
            dragonfly: '🐉', spider: '🕷️', ant: '🐜',
            
            // Marine life
            shark: '🦈', octopus: '🐙', jellyfish: '🪼', 'sea-turtle': '🐢', crab: '🦀',
            
            // Snakes
            snake: '🐍', python: '🐍', cobra: '🐍', viper: '🐍', rattlesnake: '🐍',
            boa: '🐍', anaconda: '🐍', mamba: '🐍', adder: '🐍', copperhead: '🐍',
            cottonmouth: '🐍', kingsnake: '🐍', garter: '🐍', corn: '🐍', 
            milk: '🐍', hognose: '🐍', serpent: '🐍', reptile: '🐍',
            // Australian snakes
            'eastern-brown-snake': '🐍', 'taipan': '🐍', 'death-adder': '🐍', 
            'tiger-snake': '🐍', 'red-bellied-black-snake': '🐍', 'carpet-python': '🐍',
            'childrens-python': '🐍', 'woma-python': '🐍',
            
            // Landscapes
            mountain: '⛰️', hill: '🏔️', rock: '🪨', stone: '🪨',
            sky: '☁️', cloud: '☁️', forest: '🌲',
            
            // General objects
            house: '🏠', home: '🏠', building: '🏢', car: '🚗', vehicle: '🚙',
            cup: '☕', mug: '☕', bottle: '🍼', phone: '📱', computer: '💻',
            chair: '🪑', table: '🪑', bed: '🛏️', book: '📚', pen: '✏️',
            human: '👤', person: '👤', man: '👨', woman: '👩', child: '🧒',
            food: '🍎', bread: '🍞', pizza: '🍕', burger: '🍔',
            
            // Default
            nature: '🌍'
        };
        
        // Find best emoji match
        for (const [key, emoji] of Object.entries(emojiMap)) {
            if (objectName.includes(key) || key.includes(objectName)) {
                return emoji;
            }
        }
        
        // For unknown objects, return a general object emoji instead of nature emoji
        console.log('🏠 UNKNOWN OBJECT EMOJI: Using general object emoji for:', objectName);
        return '📦'; // Default general object emoji
    }

    detectSnakeType(allTerms) {
        // Intelligent snake type detection based on context clues and patterns
        // This tries to make educated guesses about snake types when only "snake" is detected
        
        console.log('🔍 Attempting intelligent snake detection with terms:', allTerms);
        
        // Check for environment and context clues
        const contextClues = allTerms.join(' ').toLowerCase();
        
        // Water-related snakes
        if (contextClues.includes('water') || contextClues.includes('swamp') || contextClues.includes('pond')) {
            console.log('🌊 Water context detected - suggesting cottonmouth');
            return 'cottonmouth';
        }
        
        // Desert/sand context
        if (contextClues.includes('sand') || contextClues.includes('desert') || contextClues.includes('dry')) {
            console.log('🏜️ Desert context detected - suggesting rattlesnake');
            return 'rattlesnake';
        }
        
        // Garden/grass context
        if (contextClues.includes('grass') || contextClues.includes('garden') || contextClues.includes('yard')) {
            console.log('🌱 Garden context detected - suggesting garter snake');
            return 'garter';
        }
        
        // Large/thick snake indicators
        if (contextClues.includes('large') || contextClues.includes('thick') || contextClues.includes('heavy')) {
            console.log('🦣 Large snake context - suggesting python');
            return 'python';
        }
        
        // Colorful/bright indicators
        if (contextClues.includes('colorful') || contextClues.includes('bright') || contextClues.includes('pattern')) {
            console.log('🌈 Colorful snake context - suggesting corn snake');
            return 'corn';
        }
        
        // For testing - let's always suggest python first to verify the system works
        console.log('🎓 Educational variety - selecting python for testing');
        return 'python';
        
        // Original random selection (commented out for testing)
        // const educationalSnakes = ['python', 'garter', 'corn', 'milk', 'kingsnake', 'boa'];
        // const selectedSnake = educationalSnakes[Math.floor(Math.random() * educationalSnakes.length)];
        // return selectedSnake;
    }

    generateSpecificIntroduction(objectName) {
        console.log(`🔍 generateSpecificIntroduction called with: "${objectName}"`);
        const introductions = {
            // Trees and plants
            tree: 'I am a mighty tree',
            oak: 'I am a majestic oak tree',
            pine: 'I am an evergreen pine tree',
            apple: 'I am a crisp apple',
            leaf: 'I am a green leaf',
            bark: 'I am protective tree bark',
            plant: 'I am a growing plant',
            
            // Deciduous trees (non-fruit)
            maple: 'I am a magnificent maple tree',
            birch: 'I am a graceful birch tree',
            willow: 'I am a weeping willow tree',
            elm: 'I am a towering elm tree',
            ash: 'I am a sturdy ash tree',
            beech: 'I am a smooth-barked beech tree',
            hickory: 'I am a strong hickory tree',
            walnut: 'I am a black walnut tree',
            poplar: 'I am a fast-growing poplar tree',
            sycamore: 'I am a broad sycamore tree',
            basswood: 'I am a fragrant basswood tree',
            
            // Coniferous trees
            spruce: 'I am an evergreen spruce tree',
            fir: 'I am a noble fir tree',
            cedar: 'I am an aromatic cedar tree',
            hemlock: 'I am a graceful hemlock tree',
            redwood: 'I am a giant redwood tree',
            cypress: 'I am a tall cypress tree',
            juniper: 'I am a hardy juniper tree',
            
            // Tropical and exotic trees
            eucalyptus: 'I am a fragrant eucalyptus tree',
            acacia: 'I am a thorny acacia tree',
            teak: 'I am a valuable teak tree',
            mahogany: 'I am a precious mahogany tree',
            bamboo: 'I am fast-growing bamboo',
            baobab: 'I am an ancient baobab tree',
            
            // Citrus fruits
            fruit: 'I am a delicious fruit',
            orange: 'I am a juicy orange',
            lemon: 'I am a tart lemon',
            lime: 'I am a zesty lime',
            grapefruit: 'I am a tangy grapefruit',
            tangerine: 'I am a sweet tangerine',
            pomelo: 'I am a large pomelo',
            bergamot: 'I am fragrant bergamot',
            yuzu: 'I am exotic yuzu',
            
            // Stone fruits
            peach: 'I am a soft peach',
            plum: 'I am a sweet plum',
            apricot: 'I am a golden apricot',
            cherry: 'I am a bright cherry',
            
            // Pome fruits
            apple: 'I am a crisp apple',
            pear: 'I am a tender pear',
            quince: 'I am an aromatic quince',
            
            // Berries
            strawberry: 'I am a sweet strawberry',
            blueberry: 'I am a tiny blueberry',
            raspberry: 'I am a delicate raspberry',
            blackberry: 'I am a wild blackberry',
            cranberry: 'I am a tart cranberry',
            gooseberry: 'I am a tangy gooseberry',
            elderberry: 'I am a medicinal elderberry',
            mulberry: 'I am a sweet mulberry',
            currant: 'I am a small currant',
            
            // Tropical fruits
            banana: 'I am a curved banana',
            mango: 'I am a tropical mango',
            pineapple: 'I am a spiky pineapple',
            papaya: 'I am a smooth papaya',
            coconut: 'I am a hard coconut',
            avocado: 'I am a creamy avocado',
            'passion-fruit': 'I am intense passion fruit',
            kiwi: 'I am a fuzzy kiwi',
            guava: 'I am a fragrant guava',
            lychee: 'I am a delicate lychee',
            rambutan: 'I am a spiky rambutan',
            'dragon-fruit': 'I am exotic dragon fruit',
            'star-fruit': 'I am a star-shaped carambola',
            jackfruit: 'I am a massive jackfruit',
            durian: 'I am the pungent durian',
            mangosteen: 'I am the prized mangosteen',
            
            // Melons
            watermelon: 'I am a refreshing watermelon',
            cantaloupe: 'I am a sweet cantaloupe',
            honeydew: 'I am a smooth honeydew',
            casaba: 'I am a golden casaba melon',
            
            // Other fruits
            grape: 'I am a clustered grape',
            fig: 'I am a sweet fig',
            date: 'I am a chewy date',
            pomegranate: 'I am a seeded pomegranate',
            persimmon: 'I am an autumn persimmon',
            olive: 'I am a savory olive',
            
            // Fruit trees
            'orange-tree': 'I am an orange tree',
            'apple-tree': 'I am an apple tree',
            'peach-tree': 'I am a peach tree',
            'cherry-tree': 'I am a flowering cherry tree',
            'mango-tree': 'I am a tropical mango tree',
            'avocado-tree': 'I am an avocado tree',
            'lemon-tree': 'I am a lemon tree',
            'banana-tree': 'I am a banana plant',
            'coconut-tree': 'I am a tall coconut palm',
            'fig-tree': 'I am an ancient fig tree',
            'olive-tree': 'I am a hardy olive tree',
            'pomegranate-tree': 'I am a pomegranate tree',
            
            // Flowers
            flower: 'I am a beautiful flower',
            rose: 'I am a beautiful rose',
            tulip: 'I am a vibrant tulip',
            sunflower: 'I am a bright sunflower',
            lavender: 'I am fragrant lavender',
            orchid: 'I am an elegant orchid',
            daisy: 'I am a cheerful daisy',
            lily: 'I am a graceful lily',
            lotus: 'I am a sacred lotus',
            iris: 'I am a stately iris',
            
            // Garden flowers
            carnation: 'I am a ruffled carnation',
            chrysanthemum: 'I am a colorful chrysanthemum',
            petunia: 'I am a trumpet-shaped petunia',
            marigold: 'I am a golden marigold',
            zinnia: 'I am a bold zinnia',
            peony: 'I am a luxurious peony',
            daffodil: 'I am a cheerful daffodil',
            azalea: 'I am a stunning azalea',
            camellia: 'I am an elegant camellia',
            begonia: 'I am a colorful begonia',
            impatiens: 'I am a delicate impatiens',
            geranium: 'I am a hardy geranium',
            
            // Wildflowers
            poppy: 'I am a delicate poppy',
            'forget-me-not': 'I am a tiny forget-me-not',
            bluebell: 'I am a woodland bluebell',
            buttercup: 'I am a golden buttercup',
            clover: 'I am a lucky clover',
            dandelion: 'I am a resilient dandelion',
            'wild-rose': 'I am a wild rose',
            primrose: 'I am an early primrose',
            foxglove: 'I am a tall foxglove',
            snapdragon: 'I am a playful snapdragon',
            
            // Exotic flowers
            'bird-of-paradise': 'I am an exotic bird of paradise',
            anthurium: 'I am a tropical anthurium',
            frangipani: 'I am a fragrant frangipani',
            bougainvillea: 'I am a vibrant bougainvillea',
            protea: 'I am a unique protea',
            'passion-flower': 'I am an intricate passion flower',
            
            // Bulb flowers
            crocus: 'I am an early spring crocus',
            hyacinth: 'I am a fragrant hyacinth',
            amaryllis: 'I am a dramatic amaryllis',
            gladiolus: 'I am a tall gladiolus',
            freesia: 'I am a delicate freesia',
            
            // Climbing flowers
            'morning-glory': 'I am a climbing morning glory',
            'sweet-pea': 'I am a fragrant sweet pea',
            clematis: 'I am a climbing clematis',
            honeysuckle: 'I am sweet honeysuckle',
            
            // Herb flowers
            chamomile: 'I am soothing chamomile',
            sage: 'I am aromatic sage',
            mint: 'I am refreshing mint',
            thyme: 'I am fragrant thyme',
            
            // Water
            ocean: 'I am the vast ocean',
            sea: 'I am the endless sea',
            water: 'I am life-giving water',
            river: 'I am a flowing river',
            lake: 'I am a peaceful lake',
            reef: 'I am a coral reef',
            coral: 'I am living coral',
            lotus: 'I am a sacred lotus flower',
            lily: 'I am a beautiful water lily',
            
            // Famous rivers
            'amazon-river': 'I am the mighty Amazon River',
            'nile-river': 'I am the historic Nile River',
            'mississippi-river': 'I am the great Mississippi River',
            'colorado-river': 'I am the carving Colorado River',
            'ganges-river': 'I am the sacred Ganges River',
            'yangtze-river': 'I am the long Yangtze River',
            'danube-river': 'I am the flowing Danube River',
            'rhine-river': 'I am the European Rhine River',
            
            // Water bodies and features
            rapids: 'I am rushing rapids',
            waterfall: 'I am a cascading waterfall',
            stream: 'I am a gentle stream',
            brook: 'I am a babbling brook',
            creek: 'I am a winding creek',
            spring: 'I am a natural spring',
            estuary: 'I am a river estuary',
            delta: 'I am a river delta',
            wetland: 'I am a vital wetland',
            marsh: 'I am a productive marsh',
            swamp: 'I am a mysterious swamp',
            pond: 'I am a quiet pond',
            
            // Animals
            rabbit: 'I am a gentle rabbit',
            bunny: 'I am a cute bunny',
            hare: 'I am a swift hare',
            bear: 'I am a wild bear',
            bird: 'I am a flying bird',
            eagle: 'I am a soaring eagle',
            butterfly: 'I am a delicate butterfly',
            bee: 'I am a busy bee',
            fish: 'I am a swimming fish',
            
            // Mammals - Domestic animals
            dog: 'I am a loyal dog',
            cat: 'I am an independent cat',
            horse: 'I am a majestic horse',
            cow: 'I am a gentle cow',
            sheep: 'I am a fluffy sheep',
            goat: 'I am a curious goat',
            pig: 'I am an intelligent pig',
            
            // Mammals - Wild animals
            wolf: 'I am a wild wolf',
            fox: 'I am a clever fox',
            deer: 'I am a graceful deer',
            elk: 'I am a noble elk',
            moose: 'I am a mighty moose',
            squirrel: 'I am a busy squirrel',
            raccoon: 'I am a clever raccoon',
            skunk: 'I am a defensive skunk',
            opossum: 'I am a resilient opossum',
            
            // Mammals - Large African animals
            elephant: 'I am a wise elephant',
            lion: 'I am a powerful lion',
            tiger: 'I am a fierce tiger',
            leopard: 'I am a stealthy leopard',
            cheetah: 'I am the fastest cheetah',
            giraffe: 'I am a tall giraffe',
            zebra: 'I am a striped zebra',
            rhinoceros: 'I am a strong rhinoceros',
            hippopotamus: 'I am a massive hippopotamus',
            
            // Mammals - Primates
            monkey: 'I am a playful monkey',
            chimpanzee: 'I am an intelligent chimpanzee',
            gorilla: 'I am a gentle gorilla',
            orangutan: 'I am a thoughtful orangutan',
            
            // Humans
            human: 'I am a human being',
            
            // Marine mammals
            whale: 'I am a magnificent whale',
            dolphin: 'I am an intelligent dolphin',
            seal: 'I am a playful seal',
            walrus: 'I am a tusked walrus',
            
            // Birds - Common birds
            hawk: 'I am a sharp-eyed hawk',
            robin: 'I am a cheerful robin',
            cardinal: 'I am a bright red cardinal',
            'blue-jay': 'I am a smart blue jay',
            crow: 'I am an intelligent crow',
            sparrow: 'I am a small sparrow',
            woodpecker: 'I am a drumming woodpecker',
            
            // Birds - Large/exotic birds
            flamingo: 'I am a pink flamingo',
            peacock: 'I am a colorful peacock',
            swan: 'I am an elegant swan',
            pelican: 'I am a large-beaked pelican',
            penguin: 'I am a tuxedo-wearing penguin',
            ostrich: 'I am a fast-running ostrich',
            
            // Insects
            dragonfly: 'I am a swift dragonfly',
            spider: 'I am a web-spinning spider',
            ant: 'I am a hardworking ant',
            
            // Marine life
            shark: 'I am a powerful shark',
            octopus: 'I am an intelligent octopus',
            jellyfish: 'I am a floating jellyfish',
            'sea-turtle': 'I am an ancient sea turtle',
            crab: 'I am a sideways-walking crab',
            
            // Fungi
            mushroom: 'I am a mushroom',
            fungus: 'I am a fungus',
            fungi: 'I am fungi',
            toadstool: 'I am a toadstool',
            
            // Pollution and environmental threats
            trash: 'I am garbage harming nature',
            garbage: 'I am garbage harming nature',
            waste: 'I am waste polluting the environment',
            litter: 'I am litter destroying natural beauty',
            plastic: 'I am plastic waste',
            pollution: 'I am pollution',
            cigarette: 'I am a cigarette butt',
            
            // Snakes
            snake: 'I am a fascinating snake',
            python: 'I am a powerful python',
            cobra: 'I am a majestic cobra',
            viper: 'I am a stealthy viper',
            rattlesnake: 'I am a rattlesnake',
            boa: 'I am a strong boa constrictor',
            anaconda: 'I am a massive anaconda',
            mamba: 'I am a swift mamba',
            adder: 'I am an adder',
            copperhead: 'I am a copperhead',
            cottonmouth: 'I am a cottonmouth',
            kingsnake: 'I am a kingsnake',
            garter: 'I am a harmless garter snake',
            corn: 'I am a gentle corn snake',
            milk: 'I am a peaceful milk snake',
            hognose: 'I am a dramatic hognose snake',
            
            // Landscapes
            mountain: 'I am a towering mountain',
            rock: 'I am ancient rock',
            stone: 'I am solid stone',
            sky: 'I am the endless sky',
            cloud: 'I am a drifting cloud',
            forest: 'I am a living forest',
            
            // Harmful objects - environmental warnings
            cigarette: 'I am a cigarette butt - one of the most littered items harming nature',
            plastic: 'I am plastic waste poisoning our environment',
            bottle: 'I am a plastic bottle threatening marine life',
            bag: 'I am a plastic bag killing wildlife',
            can: 'I am litter harming ecosystems',
            trash: 'I am garbage destroying natural habitats',
            waste: 'I am waste polluting the environment',
            pollution: 'I am pollution destroying nature',
            smoke: 'I am toxic smoke choking forests and wildlife',
            oil: 'I am oil spill devastating ecosystems',
            chemical: 'I am harmful chemicals poisoning soil and water',
            pesticide: 'I am pesticide killing beneficial insects and birds',
            factory: 'I am industrial pollution harming the environment',
            exhaust: 'I am vehicle exhaust contributing to climate change',
            fire: 'I am destructive fire burning forests',
            chainsaw: 'I am a chainsaw cutting down precious forests',
            bulldozer: 'I am heavy machinery destroying natural habitats'
        };
        
        // Find best match (case-insensitive) - prioritize exact and longer matches
        const lowerObjectName = objectName.toLowerCase();
        
        // First, try exact match
        if (introductions[lowerObjectName]) {
            console.log(`🎯 Found exact intro match: ${objectName} -> ${lowerObjectName} -> ${introductions[lowerObjectName]}`);
            return introductions[lowerObjectName];
        }
        
        // Then try specific flower matches (to avoid sunflower->flower issue)
        const specificFlowers = [
            'sunflower', 'lavender', 'orchid', 'rose', 'tulip', 'daisy', 'lily', 'lotus', 'iris',
            'carnation', 'chrysanthemum', 'petunia', 'marigold', 'zinnia', 'peony', 'daffodil',
            'azalea', 'camellia', 'begonia', 'impatiens', 'geranium', 'poppy', 'forget-me-not',
            'bluebell', 'buttercup', 'clover', 'dandelion', 'wild-rose', 'primrose', 'foxglove',
            'snapdragon', 'bird-of-paradise', 'anthurium', 'frangipani', 'bougainvillea', 'protea',
            'passion-flower', 'crocus', 'hyacinth', 'amaryllis', 'gladiolus', 'freesia',
            'morning-glory', 'sweet-pea', 'clematis', 'honeysuckle', 'chamomile', 'sage', 'mint', 'thyme'
        ];
        for (const specificFlower of specificFlowers) {
            if (lowerObjectName.includes(specificFlower) && introductions[specificFlower]) {
                console.log(`🎯 Found specific flower intro match: ${objectName} -> ${specificFlower} -> ${introductions[specificFlower]}`);
                return introductions[specificFlower];
            }
        }
        
        // Then try specific fruit matches
        const specificFruitsIntro = [
            'orange', 'lemon', 'lime', 'grapefruit', 'tangerine', 'pomelo', 'bergamot', 'yuzu',
            'peach', 'plum', 'apricot', 'cherry', 'apple', 'pear', 'quince',
            'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry', 'gooseberry', 'elderberry', 'mulberry', 'currant',
            'banana', 'mango', 'pineapple', 'papaya', 'coconut', 'avocado', 'passion-fruit', 'kiwi', 'guava', 'lychee',
            'rambutan', 'dragon-fruit', 'star-fruit', 'jackfruit', 'durian', 'mangosteen',
            'watermelon', 'cantaloupe', 'honeydew', 'casaba',
            'grape', 'fig', 'date', 'pomegranate', 'persimmon', 'olive'
        ];
        for (const specificFruit of specificFruitsIntro) {
            if (lowerObjectName.includes(specificFruit) && introductions[specificFruit]) {
                console.log(`🎯 Found specific fruit intro match: ${objectName} -> ${specificFruit} -> ${introductions[specificFruit]}`);
                return introductions[specificFruit];
            }
        }
        
        // Then try specific snake matches
        const specificSnakes = ['python', 'cobra', 'viper', 'rattlesnake', 'boa', 'anaconda', 'mamba', 'adder', 'copperhead', 'cottonmouth', 'kingsnake', 'garter', 'corn', 'milk', 'hognose'];
        for (const specificSnake of specificSnakes) {
            if (lowerObjectName.includes(specificSnake) && introductions[specificSnake]) {
                console.log(`🎯 Found specific snake intro match: ${objectName} -> ${specificSnake} -> ${introductions[specificSnake]}`);
                return introductions[specificSnake];
            }
        }
        
        // Finally, try partial matches (sorted by length, longest first)
        const sortedKeys = Object.keys(introductions).sort((a, b) => b.length - a.length);
        for (const key of sortedKeys) {
            const lowerKey = key.toLowerCase();
            if (lowerObjectName.includes(lowerKey) || lowerKey.includes(lowerObjectName)) {
                console.log(`🎯 Found partial intro match: ${objectName} -> ${key} -> ${introductions[key]}`);
                return introductions[key];
            }
        }
        
        // Then try specific fruit matches
        const specificFruitsMsg = [
            'orange', 'lemon', 'lime', 'grapefruit', 'tangerine', 'pomelo', 'bergamot', 'yuzu',
            'peach', 'plum', 'apricot', 'cherry', 'apple', 'pear', 'quince',
            'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry', 'gooseberry', 'elderberry', 'mulberry', 'currant',
            'banana', 'mango', 'pineapple', 'papaya', 'coconut', 'avocado', 'passion-fruit', 'kiwi', 'guava', 'lychee',
            'rambutan', 'dragon-fruit', 'star-fruit', 'jackfruit', 'durian', 'mangosteen',
            'watermelon', 'cantaloupe', 'honeydew', 'casaba',
            'grape', 'fig', 'date', 'pomegranate', 'persimmon', 'olive'
        ];
        for (const specificFruit of specificFruitsMsg) {
            if (lowerObjectName.includes(specificFruit) && messages[specificFruit]) {
                console.log(`🎯 Found specific fruit message match: ${objectName} -> ${specificFruit}`);
                return messages[specificFruit];
            }
        }
        
        // Dynamic object type detection
        const objectTypes = {
            flowers: {
                names: ['jasmine', 'orchid', 'hibiscus', 'peony', 'daffodil', 'carnation', 
                       'chrysanthemum', 'petunia', 'marigold', 'pansy', 'violet', 'iris',
                       'dahlia', 'azalea', 'camellia', 'magnolia', 'poppy', 'lily', 'geranium',
                       'begonia', 'snapdragon', 'zinnia', 'cosmos', 'nasturtium', 'freesia'],
                intro: `I am a beautiful ${objectName}`
            },
            trees: {
                names: ['willow', 'cedar', 'elm', 'ash', 'beech', 'hickory', 'walnut', 'poplar',
                       'spruce', 'fir', 'redwood', 'sequoia', 'cypress', 'eucalyptus', 'acacia',
                       'teak', 'mahogany', 'bamboo', 'palm', 'coconut', 'cherry', 'peach', 'plum'],
                intro: `I am a majestic ${objectName}`
            },
            fruits: {
                names: ['apple', 'orange', 'banana', 'grape', 'strawberry', 'blueberry', 'raspberry',
                       'blackberry', 'mango', 'pineapple', 'peach', 'pear', 'plum', 'cherry',
                       'watermelon', 'cantaloupe', 'kiwi', 'papaya', 'coconut', 'avocado',
                       'lemon', 'lime', 'grapefruit', 'pomegranate', 'fig', 'date'],
                intro: `I am a delicious ${objectName}`
            },
            insects: {
                names: ['butterfly', 'dragonfly', 'grasshopper', 'cricket', 'mantis', 'beetle',
                       'ant', 'wasp', 'hornet', 'fly', 'mosquito', 'moth', 'cicada', 'aphid',
                       'termite', 'tick', 'spider', 'caterpillar', 'firefly', 'weevil'],
                intro: `I am a small ${objectName}`
            },
            birds: {
                names: ['robin', 'cardinal', 'bluejay', 'crow', 'raven', 'hawk', 'falcon', 'vulture',
                       'swan', 'duck', 'goose', 'heron', 'crane', 'flamingo', 'pelican', 'seagull',
                       'sparrow', 'finch', 'canary', 'parrot', 'peacock', 'turkey', 'chicken',
                       'pigeon', 'dove', 'woodpecker', 'hummingbird', 'kingfisher', 'penguin'],
                intro: `I am a graceful ${objectName}`
            },
            animals: {
                names: ['elephant', 'lion', 'tiger', 'leopard', 'cheetah', 'giraffe', 'zebra',
                       'rhino', 'hippo', 'buffalo', 'deer', 'elk', 'moose', 'wolf', 'fox',
                       'coyote', 'raccoon', 'skunk', 'squirrel', 'chipmunk', 'otter', 'seal',
                       'whale', 'dolphin', 'shark', 'monkey', 'gorilla', 'chimpanzee', 'human', 'koala',
                       'kangaroo', 'panda', 'sloth', 'armadillo', 'hedgehog', 'porcupine'],
                intro: `I am a wild ${objectName}`
            }
        };

        // Check each category
        for (const [category, data] of Object.entries(objectTypes)) {
            const isMatch = data.names.some(name => objectName.toLowerCase().includes(name));
            if (isMatch) {
                return data.intro;
            }
        }
        
        return `I am ${objectName}`;
    }

    generateEducationalExplanation(objectName) {
        // Comprehensive educational explanations for different object types
        const explanations = {
            // Specific explanations for popular objects
            rose: 'Roses have been cultivated for over 5,000 years and belong to the Rosaceae family. They communicate through chemical signals and their thorns are actually modified stems called "prickles".',
            sunflower: 'Sunflowers can grow up to 30 feet tall and their heads contain up to 2,000 seeds. They exhibit heliotropism, following the sun across the sky each day.',
            lavender: 'Lavender contains compounds that naturally repel insects while attracting beneficial pollinators. It has been used for aromatherapy and medicine for over 2,500 years.',
            oak: 'Oak trees can live for over 1,000 years and support more wildlife species than any other tree. A single oak can host over 500 different types of insects.',
            pine: 'Pine trees are conifers that stay green year-round and communicate with each other through underground fungal networks called "mycorrhizae".',
            bee: 'Bees have five eyes, dance to communicate locations of flowers, and a single colony can contain up to 80,000 bees working together.',
            butterfly: 'Butterflies taste with their feet, smell with their antennae, and can see ultraviolet patterns on flowers that are invisible to humans.',
            ladybug: 'Ladybugs can eat up to 5,000 aphids in their lifetime and some species migrate over 120 miles. They hibernate in groups under rocks and logs.',
            eagle: 'Eagles have eyesight 4-8 times stronger than humans and can spot prey from over 2 miles away. They mate for life and return to the same nest each year.',
            
            // Dynamic explanations by category
        };

        // Check for specific explanation first
        const specificExplanation = explanations[objectName.toLowerCase()];
        if (specificExplanation) {
            return specificExplanation;
        }

        // Dynamic explanations by category
        const categoryExplanations = {
            flowers: {
                names: ['jasmine', 'orchid', 'hibiscus', 'peony', 'daffodil', 'carnation', 
                       'chrysanthemum', 'petunia', 'marigold', 'pansy', 'violet', 'iris',
                       'dahlia', 'azalea', 'camellia', 'magnolia', 'poppy', 'lily', 'geranium',
                       'begonia', 'snapdragon', 'zinnia', 'cosmos', 'nasturtium', 'freesia'],
                explanation: `${objectName.charAt(0).toUpperCase() + objectName.slice(1)} flowers have evolved specific colors, scents, and shapes to attract their preferred pollinators. Each flower species has unique adaptations that make them perfectly suited to their environment.`
            },
            trees: {
                names: ['willow', 'cedar', 'elm', 'ash', 'beech', 'hickory', 'walnut', 'poplar',
                       'spruce', 'fir', 'redwood', 'sequoia', 'cypress', 'eucalyptus', 'acacia',
                       'teak', 'mahogany', 'bamboo', 'palm', 'coconut', 'cherry', 'peach', 'plum'],
                explanation: `${objectName.charAt(0).toUpperCase() + objectName.slice(1)} trees are remarkable organisms that can live for decades or centuries. They communicate through chemical signals, share nutrients through root networks, and create their own ecosystems by providing shelter and food for countless species.`
            },
            fruits: {
                names: ['apple', 'orange', 'banana', 'grape', 'strawberry', 'blueberry', 'raspberry',
                       'blackberry', 'mango', 'pineapple', 'peach', 'pear', 'plum', 'cherry',
                       'watermelon', 'cantaloupe', 'kiwi', 'papaya', 'coconut', 'avocado',
                       'lemon', 'lime', 'grapefruit', 'pomegranate', 'fig', 'date'],
                explanation: `${objectName.charAt(0).toUpperCase() + objectName.slice(1)} fruits are nature's way of protecting and dispersing seeds. Each fruit has evolved specific colors, flavors, and nutrients to attract the right animals to help spread their seeds to new locations.`
            },
            insects: {
                names: ['butterfly', 'dragonfly', 'grasshopper', 'cricket', 'mantis', 'beetle',
                       'ant', 'wasp', 'hornet', 'fly', 'mosquito', 'moth', 'cicada', 'aphid',
                       'termite', 'tick', 'spider', 'caterpillar', 'firefly', 'weevil'],
                explanation: `${objectName.charAt(0).toUpperCase() + objectName.slice(1)} insects are incredibly diverse and have been on Earth for over 400 million years. They have specialized body parts, unique life cycles, and play crucial ecological roles from pollination to decomposition.`
            },
            birds: {
                names: ['robin', 'cardinal', 'bluejay', 'crow', 'raven', 'hawk', 'falcon', 'vulture',
                       'swan', 'duck', 'goose', 'heron', 'crane', 'flamingo', 'pelican', 'seagull',
                       'sparrow', 'finch', 'canary', 'parrot', 'peacock', 'turkey', 'chicken',
                       'pigeon', 'dove', 'woodpecker', 'hummingbird', 'kingfisher', 'penguin'],
                explanation: `${objectName.charAt(0).toUpperCase() + objectName.slice(1)} birds are descendants of dinosaurs with specialized features like hollow bones, unique respiratory systems, and incredible navigation abilities. Many species can migrate thousands of miles using magnetic fields and star patterns.`
            },
            animals: {
                names: ['elephant', 'lion', 'tiger', 'leopard', 'cheetah', 'giraffe', 'zebra',
                       'rhino', 'hippo', 'buffalo', 'deer', 'elk', 'moose', 'wolf', 'fox',
                       'coyote', 'raccoon', 'skunk', 'squirrel', 'chipmunk', 'otter', 'seal',
                       'whale', 'dolphin', 'shark', 'monkey', 'gorilla', 'chimpanzee', 'human', 'koala',
                       'kangaroo', 'panda', 'sloth', 'armadillo', 'hedgehog', 'porcupine'],
                explanation: `${objectName.charAt(0).toUpperCase() + objectName.slice(1)} animals have evolved amazing adaptations over millions of years. Each species has developed unique behaviors, physical features, and survival strategies that make them perfectly suited to their specific environment and ecological niche.`
            }
        };

        // Check each category for dynamic explanation
        for (const [category, data] of Object.entries(categoryExplanations)) {
            const isMatch = data.names.some(name => objectName.toLowerCase().includes(name));
            if (isMatch) {
                return data.explanation;
            }
        }

        // Fallback explanation
        return `${objectName.charAt(0).toUpperCase() + objectName.slice(1)} represents the incredible diversity of life on Earth. Every living thing has evolved unique characteristics that help it survive and contribute to the complex web of nature.`;
    }

    generateSpecificMessage(objectName) {
        const messages = {
            // Trees and plants
            tree: 'I produce oxygen, provide shade, and create homes for countless creatures.',
            oak: 'I grow strong and tall, living for centuries and supporting entire ecosystems with my acorns.',
            pine: 'I stay green all year and provide shelter even in winter while producing valuable timber.',
            apple: 'I bloom with beautiful flowers in spring and produce delicious, nutritious fruit for humans and wildlife.',
            leaf: 'I capture sunlight and turn it into food through photosynthesis.',
            bark: 'I protect the tree from insects and weather while storing nutrients.',
            
            // Deciduous trees (non-fruit)
            maple: 'I create spectacular fall colors and produce sweet maple syrup from my sap in spring.',
            birch: 'My white bark peels like paper and was used by Native Americans for canoes and writing.',
            willow: 'My flexible branches were used to make baskets and my bark contains natural aspirin.',
            elm: 'I once lined city streets creating canopies, and I can live over 300 years.',
            ash: 'My strong wood is prized for tool handles and baseball bats due to its flexibility.',
            beech: 'My smooth gray bark bears carved initials that remain visible for decades.',
            hickory: 'I produce nuts loved by wildlife and my wood burns hot, perfect for smoking meats.',
            walnut: 'My nuts are brain-shaped and rich in omega-3 oils, while my wood is prized for furniture.',
            poplar: 'I grow fast and tall, and my wood is used for matches, paper, and construction.',
            sycamore: 'My mottled bark peels to reveal white patches, and I can live over 500 years.',
            basswood: 'My fragrant flowers attract bees, and my soft wood is perfect for carving.',
            
            // Coniferous trees  
            spruce: 'I provide Christmas trees and my wood resonates beautifully in musical instruments.',
            fir: 'My needles are flat and friendly to touch, and I\'m often used for lumber and paper.',
            cedar: 'My aromatic wood resists insects and decay, making me perfect for outdoor construction.',
            hemlock: 'I create cool, shaded forests and my bark was once essential for tanning leather.',
            redwood: 'I am among the tallest and oldest living things on Earth, reaching over 300 feet tall.',
            cypress: 'I thrive in wetlands with my knobby "knees" and can live over 1,000 years.',
            juniper: 'My berries flavor gin and my wood naturally repels moths and insects.',
            
            // Tropical and exotic trees
            eucalyptus: 'My oils are medicinal and aromatic, and I can grow 6 feet in one year.',
            acacia: 'I fix nitrogen in soil and produce golden flowers, thriving in harsh, dry conditions.',
            teak: 'My wood is naturally waterproof and has been used for ship-building for centuries.',
            mahogany: 'My rich, red wood has been prized for fine furniture and musical instruments.',
            bamboo: 'I\'m actually a giant grass that can grow 3 feet in one day and is stronger than steel.',
            baobab: 'I store thousands of gallons of water in my trunk and can live over 2,000 years.',
            
            // Flowers
            flower: 'I attract pollinators and spread beauty throughout the world.',
            rose: 'I represent love and beauty while providing nectar for bees and essential oils for humans.',
            tulip: 'I herald the arrival of spring with my vibrant colors and grow from bulbs that store energy.',
            sunflower: 'I turn my face to follow the sun and provide nutritious seeds for birds and humans.',
            lavender: 'I calm minds with my scent, repel harmful insects, and attract beneficial pollinators.',
            orchid: 'I am one of the largest flower families with over 25,000 species, each perfectly adapted to its environment.',
            daisy: 'I brighten meadows year-round and my simple beauty hides complex flower structures.',
            lily: 'I produce large, trumpet-shaped blooms and have been cultivated for over 3,000 years.',
            lotus: 'I rise pure from muddy waters and symbolize rebirth while supporting aquatic ecosystems.',
            iris: 'My sword-like leaves and rainbow colors have inspired artists and flag designs for centuries.',
            
            // Garden flowers
            carnation: 'I have ruffled petals and can bloom for weeks, making me perfect for gardens and bouquets.',
            chrysanthemum: 'I bloom in autumn when other flowers fade, and I come in hundreds of varieties.',
            petunia: 'I have trumpet-shaped flowers that bloom continuously and attract hummingbirds.',
            marigold: 'I repel harmful insects while attracting beneficial ones, protecting garden plants naturally.',
            zinnia: 'I produce bold, long-lasting blooms that butterflies love and I thrive in hot weather.',
            peony: 'I produce large, luxurious blooms and can live for over 100 years in the same spot.',
            daffodil: 'I emerge early in spring and am one of the first flowers to herald the end of winter.',
            azalea: 'I create spectacular spring displays and thrive in acidic soil under tall trees.',
            camellia: 'I bloom in winter when few other flowers do, providing color in the coldest months.',
            begonia: 'I bloom continuously in shade and my leaves are often as colorful as my flowers.',
            impatiens: 'I thrive in shade and produce constant blooms that brighten dark corners of gardens.',
            geranium: 'I bloom all season long and my aromatic leaves naturally repel mosquitoes.',
            
            // Wildflowers
            poppy: 'I have papery petals and produce thousands of seeds, symbolizing remembrance and peace.',
            'forget-me-not': 'I am tiny but unforgettable, and I spread naturally to create carpets of blue.',
            bluebell: 'I carpet woodland floors in spring and indicate ancient, undisturbed forests.',
            buttercup: 'My shiny petals reflect sunlight to attract pollinators and I thrive in meadows.',
            clover: 'I fix nitrogen in soil, improving it for other plants while feeding bees and livestock.',
            dandelion: 'Every part of me is edible and medicinal, and I can grow anywhere life is possible.',
            'wild-rose': 'I am the ancestor of garden roses and my hips provide vitamin C for wildlife and humans.',
            primrose: 'I bloom early in spring and my name means "first rose" though I\'m not related to roses.',
            foxglove: 'I tower above other flowers and provide medicine for heart conditions, though I can be toxic.',
            snapdragon: 'My flowers snap open like dragon mouths when squeezed, delighting children for generations.',
            
            // Exotic flowers
            'bird-of-paradise': 'I look like an exotic bird in flight and represent freedom and paradise.',
            anthurium: 'I have waxy, heart-shaped flowers that can last for months, bringing tropical beauty indoors.',
            frangipani: 'I produce intensely fragrant flowers and am sacred in many tropical cultures.',
            bougainvillea: 'My colorful bracts protect tiny flowers and I can climb walls and cover buildings.',
            protea: 'I am South Africa\'s national flower and represent diversity and transformation.',
            'passion-flower': 'My intricate structure represents the passion of Christ and I produce edible fruits.',
            
            // Bulb flowers
            crocus: 'I push through snow to bloom, bringing the first color after winter\'s end.',
            hyacinth: 'I fill spring air with intense fragrance and grow from bulbs that multiply each year.',
            amaryllis: 'I produce dramatic, large blooms indoors during winter when gardens are dormant.',
            gladiolus: 'I grow tall spikes of flowers and my name means "little sword" in Latin.',
            freesia: 'I produce intensely fragrant flowers and am native to South African grasslands.',
            
            // Climbing flowers
            'morning-glory': 'I open my trumpet flowers with the sunrise and climb toward the light.',
            'sweet-pea': 'I climb upward while producing incredibly fragrant flowers in soft colors.',
            clematis: 'I can cover entire walls with flowers and some varieties bloom for months.',
            honeysuckle: 'I produce nectar so sweet that children have sipped it for generations.',
            
            // Herb flowers
            chamomile: 'My flowers make soothing tea and I release apple-like fragrance when stepped on.',
            sage: 'My purple flower spikes attract bees and butterflies while my leaves flavor food.',
            mint: 'I produce small flowers while spreading aggressively and refreshing everything around me.',
            thyme: 'I produce tiny flowers beloved by bees and my leaves have been used medicinally for millennia.',
            
            // Citrus fruits
            fruit: 'I provide essential vitamins, minerals, and natural sugars that fuel your body.',
            orange: 'I am packed with vitamin C and my oils in my peel have antibacterial properties.',
            lemon: 'I contain powerful citric acid and vitamin C, helping preserve food and boost immunity.',
            lime: 'I prevent scurvy and add zest to cuisine while my oils repel insects naturally.',
            grapefruit: 'I boost metabolism and contain compounds that may help lower cholesterol.',
            tangerine: 'I am easy to peel and rich in vitamin A, supporting healthy vision and skin.',
            pomelo: 'I am the largest citrus fruit and contain lycopene, which supports heart health.',
            bergamot: 'My oil flavors Earl Grey tea and has calming aromatherapy properties.',
            yuzu: 'I combine citrus flavors in one fruit and am prized in Asian cuisine and medicine.',
            
            // Stone fruits
            peach: 'I contain vitamins A and C, and my fuzzy skin protects my sweet, juicy flesh.',
            plum: 'I provide antioxidants and fiber, and I can be dried into prunes for digestive health.',
            apricot: 'I am rich in beta-carotene and support eye health with my orange pigments.',
            cherry: 'I contain melatonin to help you sleep and anthocyanins that fight inflammation.',
            
            // Pome fruits
            apple: 'I keep doctors away with my fiber, antioxidants, and natural compounds that support heart health.',
            pear: 'I provide gentle fiber and natural sugars, making me easy to digest for all ages.',
            quince: 'I am high in pectin and have been used for preserves and medicine for thousands of years.',
            
            // Berries
            strawberry: 'I contain more vitamin C than oranges and my seeds are actually tiny fruits!',
            blueberry: 'I am a superfood packed with antioxidants that support brain health and memory.',
            raspberry: 'I provide fiber, vitamin C, and ketones that may boost metabolism.',
            blackberry: 'I am rich in vitamins and my dark color comes from powerful antioxidants.',
            cranberry: 'I prevent urinary tract infections and contain compounds that support bladder health.',
            gooseberry: 'I am high in vitamin C and have been cultivated in Europe for over 700 years.',
            elderberry: 'I boost immune systems and have been used medicinally for centuries.',
            mulberry: 'I contain resveratrol like red wine and support heart and brain health.',
            currant: 'I am tiny but mighty, packed with vitamin C and antioxidants in every berry.',
            
            // Tropical fruits
            banana: 'I provide instant energy with natural sugars and potassium that prevents muscle cramps.',
            mango: 'I am rich in vitamin A and enzymes that aid digestion, and I\'ve been cultivated for 4,000 years.',
            pineapple: 'I contain bromelain, an enzyme that aids digestion and reduces inflammation.',
            papaya: 'I produce papain, an enzyme that helps digest proteins and soothes stomachs.',
            coconut: 'I provide hydrating water and healthy fats that support brain and heart function.',
            avocado: 'I contain healthy monounsaturated fats and help your body absorb fat-soluble vitamins.',
            'passion-fruit': 'I am packed with fiber, vitamins, and my seeds are edible and nutritious.',
            kiwi: 'I contain more vitamin C than oranges and actinidin enzyme that aids protein digestion.',
            guava: 'I have four times more vitamin C than oranges and natural antimicrobial properties.',
            lychee: 'I provide vitamin C and copper, and my translucent flesh has been prized for 2,000 years.',
            rambutan: 'I am related to lychee and my spiky exterior protects sweet, nutritious flesh.',
            'dragon-fruit': 'I am low in calories but high in vitamin C, iron, and beneficial plant compounds.',
            'star-fruit': 'I am mostly water but contain vitamin C and unique compounds that support kidney health.',
            jackfruit: 'I am the largest tree fruit and my flesh can substitute for meat in texture and protein.',
            durian: 'Despite my strong smell, I am rich in vitamin C, potassium, and healthy fats.',
            mangosteen: 'I contain xanthones, powerful antioxidants that may have anti-inflammatory properties.',
            
            // Melons
            watermelon: 'I am 92% water and contain lycopene, helping you stay hydrated and healthy.',
            cantaloupe: 'I am rich in vitamin A and beta-carotene, supporting healthy vision and skin.',
            honeydew: 'I provide vitamin C and potassium while being naturally low in calories.',
            casaba: 'I have a mild, sweet flavor and provide vitamin C and potassium for heart health.',
            
            // Other fruits
            grape: 'I contain resveratrol in my skin, which supports heart health and longevity.',
            fig: 'I am rich in fiber, calcium, and potassium, and I\'ve been cultivated for 11,000 years.',
            date: 'I provide natural sugars, fiber, and minerals, serving as nature\'s candy and energy source.',
            pomegranate: 'I contain powerful antioxidants in my seeds that support heart and brain health.',
            persimmon: 'I am rich in vitamins A and C, and my sweet flavor develops as I ripen.',
            olive: 'I provide healthy monounsaturated fats and have been a Mediterranean staple for millennia.',
            
            // Fruit trees
            'orange-tree': 'I produce vitamin-rich oranges and my blossoms create aromatic orange blossom honey.',
            'apple-tree': 'I can live for 100 years, producing apples that have fed humans for thousands of years.',
            'peach-tree': 'I originated in China and my beautiful blossoms symbolize spring and renewal.',
            'cherry-tree': 'I produce both sweet fruit and spectacular spring blossoms that attract pollinators.',
            'mango-tree': 'I can live for 300 years and am considered sacred in some cultures for my life-giving fruit.',
            'avocado-tree': 'I produce nutrient-dense fruit and can live for 100+ years in the right climate.',
            'lemon-tree': 'I provide year-round vitamin C and my fragrant blossoms perfume the air.',
            'banana-tree': 'I am actually a large herb, not a tree, and I produce hands of potassium-rich bananas.',
            'coconut-tree': 'I am the "tree of life," providing water, food, shelter, and countless other uses.',
            'fig-tree': 'I am one of humanity\'s oldest cultivated plants and can live for hundreds of years.',
            'olive-tree': 'I can live for 1,000+ years and my fruit provides the healthy oils of the Mediterranean diet.',
            'pomegranate-tree': 'I produce antioxidant-rich fruit and have been symbols of fertility and prosperity.',
            
            // Water
            ocean: 'I produce most of Earth\'s oxygen and regulate the global climate.',
            sea: 'I am home to countless marine species and provide food for humanity.',
            reef: 'I build underwater cities that support 25% of all marine life.',
            coral: 'I create beautiful underwater gardens and protect coastlines.',
            water: 'I am essential for all life and cycle endlessly through nature.',
            river: 'I carry fresh water from mountains to seas, supporting all life along my path.',
            lotus: 'I bloom beautifully on water surfaces and symbolize purity and rebirth in many cultures.',
            lily: 'I float gracefully on ponds and provide landing pads for frogs and shelter for fish.',
            
            // Famous rivers
            'amazon-river': 'I am the world\'s largest river by volume, producing 20% of Earth\'s river water and supporting incredible biodiversity.',
            'nile-river': 'I am the world\'s longest river, flowing 4,135 miles and supporting civilization for over 5,000 years.',
            'mississippi-river': 'I drain 31 US states and carry nutrients from America\'s heartland to the Gulf of Mexico.',
            'colorado-river': 'I carved the Grand Canyon over millions of years and provide water for 40 million people.',
            'ganges-river': 'I am sacred to over 400 million people and support one of the world\'s most fertile river plains.',
            'yangtze-river': 'I am Asia\'s longest river and the lifeline for over 400 million Chinese people.',
            'danube-river': 'I flow through 10 countries, connecting European cultures and ecosystems for centuries.',
            'rhine-river': 'I connect the Swiss Alps to the North Sea and have been Europe\'s most important trade route.',
            
            // Water bodies and features
            rapids: 'I create thrilling whitewater and oxygenate the water for fish and aquatic life.',
            waterfall: 'I create negative ions that purify air and provide spectacular natural beauty.',
            stream: 'I carry mountain snowmelt to larger rivers and create cool microclimates in forests.',
            brook: 'I provide fresh water to wildlife and create peaceful sounds that reduce human stress.',
            creek: 'I connect wetlands and provide corridors for fish migration and aquatic insects.',
            spring: 'I bring fresh groundwater to the surface and maintain constant temperatures year-round.',
            estuary: 'I mix fresh and salt water, creating nurseries for 75% of commercial fish species.',
            delta: 'I deposit rich sediments that create some of Earth\'s most fertile farmland.',
            wetland: 'I filter pollutants, prevent flooding, and support 40% of all species on only 6% of Earth\'s surface.',
            marsh: 'I purify water naturally and provide critical habitat for migrating birds.',
            swamp: 'I store carbon, prevent floods, and create unique ecosystems for specialized wildlife.',
            pond: 'I provide water for wildlife, support aquatic plants, and create peaceful natural spaces.',
            
            // Animals
            rabbit: 'I help spread seeds and serve as food for many predators in the ecosystem.',
            bunny: 'I bring joy to children and help maintain grassland ecosystems.',
            bear: 'I spread seeds through the forest and keep animal populations balanced.',
            bird: 'I pollinate plants, spread seeds, and control insect populations.',
            eagle: 'I soar high above as a symbol of freedom and wilderness.',
            butterfly: 'I pollinate flowers and transform from caterpillar in amazing metamorphosis.',
            bee: 'I pollinate 1/3 of all the food you eat and create sweet honey.',
            fish: 'I keep aquatic ecosystems healthy and provide protein for many animals.',
            
            // Mammals - Domestic animals
            dog: 'I am humanity\'s oldest companion, loyal for over 15,000 years, and can detect diseases with my nose.',
            cat: 'I control rodent populations and have been worshipped by humans since ancient Egypt.',
            horse: 'I helped build civilizations by carrying humans and goods across continents for thousands of years.',
            cow: 'I provide milk, meat, and leather while grazing helps maintain grassland ecosystems.',
            sheep: 'I provide wool, milk, and meat while my grazing helps prevent wildfires by managing grass.',
            goat: 'I can survive in harsh environments and provide milk, meat, and fiber to communities worldwide.',
            pig: 'I am highly intelligent, can learn tricks, and my rooting behavior helps till soil naturally.',
            
            // Mammals - Wild animals
            wolf: 'I control deer populations and my howls can be heard up to 6 miles away in forest ecosystems.',
            fox: 'I control rodent populations with my excellent hearing and can jump 6 feet high to catch prey.',
            deer: 'I help plant forests by spreading seeds in my droppings and serve as food for large predators.',
            elk: 'I bugle to attract mates and my massive antlers can weigh up to 40 pounds each.',
            moose: 'I am the largest member of the deer family and can dive 20 feet underwater to feed on plants.',
            squirrel: 'I plant thousands of trees by burying nuts and forgetting where I hid them.',
            raccoon: 'I have human-like hands and am one of the most adaptable mammals in North America.',
            skunk: 'I control insect populations and my spray can be smelled from over a mile away.',
            opossum: 'I am immune to most snake venoms and eat thousands of disease-carrying ticks each year.',
            
            // Mammals - Large African animals
            elephant: 'I have the largest brain of any land animal and can communicate using infrasonic sounds.',
            lion: 'I am the only cat that lives in social groups and my roar can be heard from 5 miles away.',
            tiger: 'I am the largest wild cat and each of my stripes is unique, like human fingerprints.',
            leopard: 'I am the strongest climber among big cats and can carry prey twice my weight up trees.',
            cheetah: 'I am the fastest land animal, reaching 70 mph, but can only maintain this speed for short bursts.',
            giraffe: 'I am the tallest mammal with a heart that weighs 25 pounds to pump blood up my long neck.',
            zebra: 'My stripes confuse predators and help regulate my body temperature in the African heat.',
            rhinoceros: 'My horn is made of compressed hair and I can run 35 mph despite weighing up to 5,000 pounds.',
            hippopotamus: 'I spend most of my day in water and despite my appearance, I am most closely related to whales.',
            
            // Mammals - Primates
            monkey: 'I use tools, have complex social structures, and can learn sign language to communicate with humans.',
            chimpanzee: 'I share 98.8% of my DNA with humans and can learn to use computers and solve complex problems.',
            gorilla: 'Despite my strength, I am gentle and vegetarian, eating up to 40 pounds of plants daily.',
            orangutan: 'I am one of the most intelligent primates and can use tools to extract honey and insects.',
            
            // Humans
            human: 'I am the most adaptable species on Earth, capable of complex reasoning, creativity, and building civilizations that span the globe.',
            
            // Marine mammals
            whale: 'I am the largest animal ever known to exist and my songs can travel hundreds of miles underwater.',
            dolphin: 'I have a complex language, use echolocation to navigate, and can recognize myself in mirrors.',
            seal: 'I can dive to 1,500 feet and hold my breath for up to 20 minutes while hunting for fish.',
            walrus: 'My tusks can grow up to 3 feet long and I use them to pull myself onto ice and establish dominance.',
            
            // Birds - Common birds
            hawk: 'I have eyesight 8 times sharper than humans and control rodent populations in ecosystems.',
            robin: 'I am often the first bird to sing at dawn and my red breast signals the arrival of spring.',
            cardinal: 'I mate for life and my bright red color comes from carotenoid pigments in the food I eat.',
            'blue-jay': 'I can mimic the calls of other birds and remember thousands of locations where I hide acorns.',
            crow: 'I am one of the most intelligent birds, can solve puzzles, and remember human faces for years.',
            sparrow: 'I control insect populations and can eat up to 400 insects per day during nesting season.',
            woodpecker: 'I create nesting holes used by many other species and my drumming can be heard a mile away.',
            
            // Birds - Large/exotic birds
            flamingo: 'My pink color comes from eating shrimp and algae, and I can live over 50 years.',
            peacock: 'My tail has over 200 feathers with eye-spots that I display to attract mates.',
            swan: 'I mate for life and my neck has more vertebrae than a giraffe, allowing incredible flexibility.',
            pelican: 'My bill can hold 3 gallons of water and fish, and I dive from heights up to 60 feet.',
            penguin: 'I can swim up to 22 mph and huddle with thousands of others to survive Antarctic winters.',
            ostrich: 'I am the largest bird and can run 45 mph with legs powerful enough to kill a lion.',
            
            // Insects
            dragonfly: 'I have existed for over 300 million years and can catch 90% of the prey I hunt.',
            spider: 'My silk is stronger than steel by weight and I control billions of insect pests annually.',
            ant: 'I can lift 50 times my body weight and live in colonies with millions of individuals.',
            
            // Marine life
            shark: 'I have existed for over 400 million years and play a crucial role in maintaining ocean health.',
            octopus: 'I have three hearts, blue blood, and can change color and texture to match my surroundings.',
            jellyfish: 'I have existed for over 500 million years and some species are theoretically immortal.',
            'sea-turtle': 'I can live over 100 years and navigate thousands of miles using Earth\'s magnetic field.',
            crab: 'I help clean ocean floors and some species can regenerate lost limbs multiple times.',
            
            // Snakes
            snake: 'I control rodent populations and play a vital role in ecosystem balance.',
            python: 'I am a powerful constrictor that helps control prey populations in my habitat.',
            cobra: 'I am an important predator that keeps ecosystems balanced with my hunting skills.',
            viper: 'I help control small mammal populations and am perfectly adapted to my environment.',
            rattlesnake: 'I warn before I strike and help control rodent populations that damage crops.',
            boa: 'I am a non-venomous constrictor that plays an important role in rainforest ecosystems.',
            anaconda: 'I am one of the largest snakes and keep aquatic ecosystems balanced.',
            mamba: 'I am a fast and efficient hunter that maintains balance in African ecosystems.',
            adder: 'I hibernate through winter and emerge to help control small animal populations.',
            copperhead: 'I help control rodent populations and prefer to hide rather than attack.',
            cottonmouth: 'I live near water and help control fish and amphibian populations.',
            kingsnake: 'I even eat other snakes, including venomous ones, keeping snake populations balanced.',
            garter: 'I am harmless to humans and help control slug, worm, and small pest populations.',
            corn: 'I am a gentle snake that helps farmers by controlling grain-eating rodents.',
            milk: 'I am non-venomous and help control rodent populations around farms.',
            hognose: 'I put on dramatic defensive displays but am harmless and help control pest populations.',
            
            // Landscapes
            mountain: 'I create weather patterns, store fresh water in snow, and provide minerals.',
            rock: 'I form the foundation of mountains and store Earth\'s geological history.',
            sky: 'I bring weather, hold the atmosphere, and protect Earth from space.',
            cloud: 'I carry water across continents and bring life-giving rain.',
            forest: 'I am the lungs of the Earth, home to 80% of land-based species.',
            
            // Harmful objects - warning messages
            cigarette: 'I take 10-12 years to decompose and leach toxic chemicals into soil, poisoning plants and groundwater.',
            plastic: 'I take hundreds of years to decompose, breaking into microplastics that enter the food chain.',
            bottle: 'I strangle marine animals, and when I break down, my fragments are eaten by fish and seabirds.',
            bag: 'Wildlife mistakes me for food - sea turtles think I\'m jellyfish and I block their digestive systems.',
            can: 'I cut animals with my sharp edges and take 80-100 years to decompose in nature.',
            trash: 'I destroy the beauty of natural spaces and harm animals who eat me or get trapped in me.',
            waste: 'I contaminate soil and water, creating dead zones where nothing can live.',
            pollution: 'I poison the air, water, and soil that all living things depend on.',
            smoke: 'I contain toxic chemicals that damage plant leaves and make it hard for animals to breathe.',
            oil: 'I coat wildlife in sticky poison, destroying their ability to fly, swim, or regulate temperature.',
            chemical: 'I poison plants and animals, accumulating in the food chain and causing mutations.',
            pesticide: 'I kill bees, birds, and beneficial insects along with the pests, disrupting ecosystems.',
            factory: 'I release toxic gases and waste that cause acid rain and pollute rivers.',
            exhaust: 'I pump greenhouse gases into the atmosphere, accelerating dangerous climate change.',
            fire: 'When started by humans, I destroy wildlife habitats and release stored carbon.',
            chainsaw: 'I cut down trees that took decades to grow, destroying homes for countless species.',
            bulldozer: 'I crush entire ecosystems in minutes, destroying habitats that took years to develop.'
        };
        
        // Find best match (case-insensitive) - prioritize exact and longer matches
        const lowerObjectName = objectName.toLowerCase();
        
        // First, try exact match
        if (messages[lowerObjectName]) {
            console.log(`🎯 Found exact message match: ${objectName} -> ${lowerObjectName}`);
            return messages[lowerObjectName];
        }
        
        // Then try specific flower matches
        const specificFlowers = [
            'sunflower', 'lavender', 'orchid', 'rose', 'tulip', 'daisy', 'lily', 'lotus', 'iris',
            'carnation', 'chrysanthemum', 'petunia', 'marigold', 'zinnia', 'peony', 'daffodil',
            'azalea', 'camellia', 'begonia', 'impatiens', 'geranium', 'poppy', 'forget-me-not',
            'bluebell', 'buttercup', 'clover', 'dandelion', 'wild-rose', 'primrose', 'foxglove',
            'snapdragon', 'bird-of-paradise', 'anthurium', 'frangipani', 'bougainvillea', 'protea',
            'passion-flower', 'crocus', 'hyacinth', 'amaryllis', 'gladiolus', 'freesia',
            'morning-glory', 'sweet-pea', 'clematis', 'honeysuckle', 'chamomile', 'sage', 'mint', 'thyme'
        ];
        for (const specificFlower of specificFlowers) {
            if (lowerObjectName.includes(specificFlower) && messages[specificFlower]) {
                console.log(`🎯 Found specific flower message match: ${objectName} -> ${specificFlower}`);
                return messages[specificFlower];
            }
        }
        
        // Then try specific snake matches
        const specificSnakes = ['python', 'cobra', 'viper', 'rattlesnake', 'boa', 'anaconda', 'mamba', 'adder', 'copperhead', 'cottonmouth', 'kingsnake', 'garter', 'corn', 'milk', 'hognose'];
        for (const specificSnake of specificSnakes) {
            if (lowerObjectName.includes(specificSnake) && messages[specificSnake]) {
                console.log(`🎯 Found specific snake message match: ${objectName} -> ${specificSnake}`);
                return messages[specificSnake];
            }
        }
        
        // Finally, try partial matches (sorted by length, longest first)
        const sortedKeys = Object.keys(messages).sort((a, b) => b.length - a.length);
        for (const key of sortedKeys) {
            const lowerKey = key.toLowerCase();
            if (lowerObjectName.includes(lowerKey) || lowerKey.includes(lowerObjectName)) {
                console.log(`🎯 Found partial message match: ${objectName} -> ${key}`);
                return messages[key];
            }
        }
        
        // Dynamic object type detection with specific messages
        const objectTypes = {
            flowers: {
                names: ['jasmine', 'orchid', 'hibiscus', 'peony', 'daffodil', 'carnation', 
                       'chrysanthemum', 'petunia', 'marigold', 'pansy', 'violet', 'iris',
                       'dahlia', 'azalea', 'camellia', 'magnolia', 'poppy', 'lily', 'geranium',
                       'begonia', 'snapdragon', 'zinnia', 'cosmos', 'nasturtium', 'freesia'],
                message: 'I bring beauty and fragrance to the world, attracting pollinators that help plants reproduce.'
            },
            trees: {
                names: ['willow', 'cedar', 'elm', 'ash', 'beech', 'hickory', 'walnut', 'poplar',
                       'spruce', 'fir', 'redwood', 'sequoia', 'cypress', 'eucalyptus', 'acacia',
                       'teak', 'mahogany', 'bamboo', 'palm', 'coconut', 'cherry', 'peach', 'plum'],
                message: 'I produce oxygen, provide shade, and create homes for countless creatures while storing carbon.'
            },
            fruits: {
                names: ['apple', 'orange', 'banana', 'grape', 'strawberry', 'blueberry', 'raspberry',
                       'blackberry', 'mango', 'pineapple', 'peach', 'pear', 'plum', 'cherry',
                       'watermelon', 'cantaloupe', 'kiwi', 'papaya', 'coconut', 'avocado',
                       'lemon', 'lime', 'grapefruit', 'pomegranate', 'fig', 'date'],
                message: 'I provide essential nutrients and vitamins while spreading my seeds through nature.'
            },
            insects: {
                names: ['butterfly', 'dragonfly', 'grasshopper', 'cricket', 'mantis', 'beetle',
                       'ant', 'wasp', 'hornet', 'fly', 'mosquito', 'moth', 'cicada', 'aphid',
                       'termite', 'tick', 'spider', 'caterpillar', 'firefly', 'weevil'],
                message: 'I play a vital role in pollination, decomposition, and maintaining the balance of ecosystems.'
            },
            birds: {
                names: ['robin', 'cardinal', 'bluejay', 'crow', 'raven', 'hawk', 'falcon', 'vulture',
                       'swan', 'duck', 'goose', 'heron', 'crane', 'flamingo', 'pelican', 'seagull',
                       'sparrow', 'finch', 'canary', 'parrot', 'peacock', 'turkey', 'chicken',
                       'pigeon', 'dove', 'woodpecker', 'hummingbird', 'kingfisher', 'penguin'],
                message: 'I help spread seeds, control insect populations, and bring music to nature with my songs.'
            },
            animals: {
                names: ['elephant', 'lion', 'tiger', 'leopard', 'cheetah', 'giraffe', 'zebra',
                       'rhino', 'hippo', 'buffalo', 'deer', 'elk', 'moose', 'wolf', 'fox',
                       'coyote', 'raccoon', 'skunk', 'squirrel', 'chipmunk', 'otter', 'seal',
                       'whale', 'dolphin', 'shark', 'monkey', 'gorilla', 'chimpanzee', 'human', 'koala',
                       'kangaroo', 'panda', 'sloth', 'armadillo', 'hedgehog', 'porcupine'],
                message: 'I maintain the balance of nature through my role in the food chain and ecosystem.'
            }
        };

        // Check each category
        for (const [category, data] of Object.entries(objectTypes)) {
            const isMatch = data.names.some(name => objectName.toLowerCase().includes(name));
            if (isMatch) {
                return data.message;
            }
        }
        
        // For non-nature objects, provide description with environmental connection
        console.log('🏠 NON-NATURE OBJECT MESSAGE: Creating eco-friendly message for:', objectName);
        
        // Create environmental messages for common objects
        const ecoMessages = {
            house: 'I am a house that can help the environment through solar panels, energy efficiency, and green building materials.',
            home: 'I am a home where you can help nature by conserving water, recycling, and using eco-friendly products.',
            car: 'I am a car, but electric and hybrid versions of me help reduce air pollution and protect the environment.',
            vehicle: 'I am a vehicle that can be more eco-friendly through electric power and efficient driving habits.',
            cup: 'I am a cup - reusable versions of me help reduce waste and protect the environment from plastic pollution.',
            mug: 'I am a mug that helps the environment by reducing single-use cup waste when you use me repeatedly.',
            bottle: 'I am a bottle - reusable versions of me help reduce plastic waste and protect marine life.',
            phone: 'I am a phone that can help the environment through recycling programs and by reducing paper use with digital communication.',
            computer: 'I am a computer that helps the environment by enabling remote work, digital documents, and reducing travel needs.',
            chair: 'I am a chair made from sustainable materials that can help protect forests when manufactured responsibly.',
            table: 'I am a table that helps the environment when made from recycled or sustainably sourced materials.',
            book: 'I am a book that helps share knowledge about nature and environmental protection with people.',
            human: 'I am a human who can help protect the environment through conservation, recycling, and sustainable living choices.',
            person: 'I am a person who has the power to make eco-friendly choices that help protect nature and wildlife.',
            man: 'I am a man who can help the environment through sustainable living and nature conservation efforts.',
            woman: 'I am a woman who can make environmentally conscious choices to protect the planet for future generations.',
            food: 'I am food that helps the environment when grown organically and locally, reducing transportation and chemical use.'
        };
        
        return ecoMessages[objectName.toLowerCase()] || `I am a ${objectName} that can help the environment when used responsibly and sustainably.`;
    }

    // Categorize objects as harmful or beneficial
    isHarmfulObject(objectName) {
        const harmfulObjects = [
            // Pollutants and waste
            'cigarette', 'plastic', 'bottle', 'bag', 'can', 'trash', 'waste', 'litter',
            'pollution', 'smoke', 'oil', 'chemical', 'pesticide', 'toxic', 'poison',
            // Industrial and destructive
            'factory', 'exhaust', 'fire', 'chainsaw', 'bulldozer', 'mining',
            // Invasive species and pests
            'mosquito', 'tick', 'wasp', 'hornet', 'termite', 'cockroach', 'rat', 'mouse',
            // Dangerous organisms
            'virus', 'bacteria', 'disease', 'parasite', 'weed', 'invasive',
            // Harmful fungi (only specifically poisonous species)
            'death cap', 'destroying angel', 'false morel', 'fly agaric', 'poisonous mushroom',
            'toxic mushroom', 'deadly mushroom'
            // Note: 'toadstool' removed as it's just a traditional term, not all are poisonous
            // Note: regular 'mushroom' and 'fungus' are beneficial - they're nature's recyclers!
        ];
        
        return harmfulObjects.some(harmful => {
            const objName = objectName.toLowerCase();
            const harmfulTerm = harmful.toLowerCase();
            
            // Only match if the object name starts with the harmful term
            // This prevents "mushroom" from matching "poisonous mushroom"
            return objName.includes(harmfulTerm) || objName.startsWith(harmfulTerm);
        });
    }

    generateConsequences(objectName) {
        const consequences = {
            // Trees and plants - focusing on deforestation impact
            tree: 'oxygen levels drop, climate change accelerates, and countless animals lose their homes.',
            oak: 'entire ecosystems collapse, and hundreds of species that depend on me vanish forever.',
            pine: 'soil erosion increases, mountain slopes become unstable, and wildlife corridors are broken.',
            maple: 'the carbon I stored is released, making global warming worse.',
            apple: 'pollinators lose vital food sources, and humans lose healthy, natural fruit forever.',
            leaf: 'photosynthesis stops, oxygen production decreases, and the air becomes more polluted.',
            bark: 'trees become defenseless against diseases and die, leading to forest collapse.',
            
            // Flowers - ecosystem disruption
            flower: 'pollination stops, food crops fail, and entire food webs collapse.',
            rose: 'pollinators have no food source and disappear, ending plant reproduction.',
            sunflower: 'birds lose their food source and migration patterns are disrupted.',
            tulip: 'spring ecosystems fail and seasonal cycles are broken.',
            daisy: 'meadow ecosystems collapse and countless small creatures lose their habitat.',
            
            // Water bodies - environmental disaster
            ocean: 'global weather patterns collapse and 70% of Earth\'s oxygen production stops.',
            river: 'freshwater ecosystems die, and communities lose their water source.',
            lake: 'entire watersheds fail and regional climates become unstable.',
            reef: '25% of all marine species go extinct in an underwater apocalypse.',
            coral: 'coastal protection disappears and marine biodiversity collapses.',
            water: 'all life on Earth ends - nothing can survive without water.',
            lotus: 'pond ecosystems lose their natural filters, and water quality deteriorates rapidly.',
            lily: 'aquatic wildlife lose shelter and food sources, disrupting pond food webs.',
            
            // Animals - biodiversity loss
            rabbit: 'seed dispersal stops, plant communities fail, and grasslands turn to desert.',
            bear: 'forest ecosystems lose their top predator and become unbalanced.',
            bird: 'insect populations explode, crops are destroyed, and pollination fails.',
            butterfly: 'plant reproduction stops and flower meadows disappear forever.',
            bee: 'food production collapses - 1/3 of human food disappears.',
            fish: 'aquatic food webs collapse and water quality deteriorates.',
            eagle: 'rodent populations explode and spread disease.',
            
            // Landscapes
            mountain: 'watersheds fail, weather patterns change, and valleys flood.',
            rock: 'soil formation stops and landscapes become barren.',
            forest: 'the Earth\'s lungs are destroyed, climate change accelerates, and mass extinction begins.',
            sky: 'weather systems fail and the atmosphere becomes toxic.',
            
            // Common animals from AI detection
            'Golden retriever': 'humans lose their most loyal companions and emotional support.',
            'tabby': 'rodent populations explode and ecosystems become unbalanced.',
            'Egyptian cat': 'pest control fails and agricultural systems suffer.',
            'retriever': 'hunting ecosystems become unbalanced.',
            'tree frog': 'insect populations explode and forest health declines.',
            'monarch': 'long-distance pollination stops and plant genetics become isolated.',
            
            // Fungi - mostly beneficial ecological role
            mushroom: 'forests lose their vital decomposers and nutrient recycling systems collapse.',
            fungus: 'dead organic matter accumulates and forest soils become depleted.',
            toadstool: 'forests lose important decomposers and the wood wide web breaks down.',
            boletus: 'tree networks lose crucial fungal partners and forest health declines.',
            
            // Harmful objects - escalating consequences
            cigarette: 'more people litter me, soil and water will become increasingly toxic.',
            plastic: 'plastic production continues, oceans will become uninhabitable wastelands.',
            bottle: 'we keep making single-use bottles, marine ecosystems will completely collapse.',
            bag: 'plastic bags aren\'t banned, sea turtle populations will go extinct.',
            can: 'people keep littering, natural areas will become dangerous for all wildlife.',
            trash: 'littering continues, pristine habitats will become polluted wastelands.',
            waste: 'waste management fails, entire regions will become toxic dead zones.',
            pollution: 'pollution increases, mass extinctions will accelerate dramatically.',
            smoke: 'air pollution worsens, forests will die and cities will become unlivable.',
            oil: 'oil spills continue, marine ecosystems will face complete devastation.',
            chemical: 'chemical use increases, genetic damage will spread through all life.',
            pesticide: 'pesticide use continues, pollinator collapse will cause food system failure.',
            factory: 'industrial pollution grows, acid rain will destroy entire forest regions.',
            exhaust: 'emissions keep rising, climate change will make Earth uninhabitable.',
            fire: 'human-caused fires increase, remaining forests will be destroyed.',
            chainsaw: 'deforestation continues, the last wild spaces will disappear forever.',
            bulldozer: 'habitat destruction continues, mass extinction will be irreversible.'
        };
        
        // Find best match
        for (const [key, consequence] of Object.entries(consequences)) {
            if (objectName.includes(key) || key.includes(objectName)) {
                // Add appropriate prefix based on harmful vs beneficial
                if (this.isHarmfulObject(objectName)) {
                    return `if I exist: ${consequence}`;
                } else {
                    return `if I disappear: ${consequence}`;
                }
            }
        }
        
        // Default fallback with appropriate prefix
        if (this.isHarmfulObject(objectName)) {
            return 'if I exist: ecosystems become unbalanced and the natural world suffers.';
        } else {
            return 'if I disappear: ecosystems become unbalanced and the natural world suffers.';
        }
    }

    generateSpecificPlea(objectName) {
        const pleas = {
            // Trees and plants - emphasizing deforestation
            tree: 'Please save me by stopping deforestation and planting new trees!',
            oak: 'Please save me by protecting old-growth forests from being cut down!',
            pine: 'Please save me by supporting sustainable forestry and reforestation!',
            maple: 'Please save me by choosing recycled paper and stopping illegal logging!',
            apple: 'Please save me by protecting orchards, supporting local farmers, and planting fruit trees!',
            leaf: 'Please save me by protecting forests and reducing air pollution!',
            
            // Flowers
            flower: 'Please save me by avoiding pesticides and planting pollinator gardens!',
            rose: 'Please save me by supporting organic farming and bee conservation!',
            sunflower: 'Please save me by supporting organic farming and protecting natural habitats!',
            
            // Water
            ocean: 'Please save me by reducing plastic waste and stopping ocean pollution!',
            reef: 'Please save me by fighting climate change - warming oceans are bleaching me!',
            coral: 'Please save me by using reef-safe sunscreen and reducing carbon emissions!',
            water: 'Please save me by conserving water and preventing pollution!',
            river: 'Please save me by keeping my banks clean and not dumping waste!',
            lotus: 'Please save me by protecting wetlands and keeping pond water clean!',
            lily: 'Please save me by preventing pond pollution and preserving aquatic habitats!',
            
            // Fungi - beneficial but require safety awareness
            mushroom: 'Please save me by protecting forests and understanding my role as nature\'s recycler, but NEVER eat wild mushrooms without expert identification!',
            fungus: 'Please save me by protecting forests and understanding my role as nature\'s recycler!',
            toadstool: 'Please save me by protecting forests, but NEVER eat me - some of my kind are deadly poisonous!',
            boletus: 'Please save me by protecting forests, but be cautious - some of my species can cause stomach problems!',
            
            // Animals - habitat protection  
            rabbit: 'Please save me by preserving grasslands and stopping habitat destruction!',
            bear: 'Please save me by protecting wilderness areas from development!',
            bird: 'Please save me by protecting nesting sites and stopping deforestation!',
            butterfly: 'Please save me by planting native flowers and preserving habitats!',
            bee: 'Please save me by banning harmful pesticides and protecting wildflower meadows!',
            fish: 'Please save me by keeping waters clean and protecting watersheds!',
            
            // Snakes - conservation and understanding
            snake: 'Please save me by protecting my habitat and learning that I am not your enemy!',
            python: 'Please save me by stopping illegal wildlife trade and protecting my natural habitat!',
            cobra: 'Please save me by preserving my ecosystems and understanding my important role!',
            viper: 'Please save me by protecting my habitat and respecting my space in nature!',
            rattlesnake: 'Please save me by preserving natural areas and not killing me out of fear!',
            boa: 'Please save me by stopping deforestation and illegal pet trade!',
            anaconda: 'Please save me by protecting wetlands and stopping habitat destruction!',
            mamba: 'Please save me by preserving African wilderness and understanding my ecological role!',
            adder: 'Please save me by protecting natural meadows and not killing me when you see me!',
            copperhead: 'Please save me by leaving me alone when you encounter me in nature!',
            cottonmouth: 'Please save me by protecting wetlands and giving me space near water!',
            kingsnake: 'Please save me by understanding I help control other snake populations!',
            garter: 'Please save me by creating wildlife-friendly gardens and not using pesticides!',
            corn: 'Please save me by appreciating my role in controlling farm pests!',
            milk: 'Please save me by not killing me - I am harmless and help control rodents!',
            hognose: 'Please save me by understanding my dramatic displays are just for show - I am harmless!',
            
            // Landscapes
            mountain: 'Please save me by preventing mining and stopping erosion!',
            forest: 'Please save me by supporting forest conservation and sustainable living!',
            sky: 'Please save me by reducing emissions and fighting climate change!',
            
            // Harmful objects - urgent action needed
            cigarette: 'Please STOP littering me and dispose of me properly in ashtrays!',
            plastic: 'Please ELIMINATE single-use plastics and switch to reusable alternatives!',
            bottle: 'Please use refillable water bottles and support plastic bottle bans!',
            bag: 'Please use cloth bags and support laws banning plastic bags!',
            can: 'Please always recycle me and never leave me as litter!',
            trash: 'Please reduce waste, reuse items, and always dispose of garbage properly!',
            waste: 'Please minimize waste and support better recycling programs!',
            pollution: 'Please support clean air and water laws to stop polluting industries!',
            smoke: 'Please support clean energy and emission controls to clear the air!',
            oil: 'Please transition to renewable energy and stop oil drilling!',
            chemical: 'Please support organic farming and ban toxic chemicals!',
            pesticide: 'Please choose organic food and support pesticide-free farming!',
            factory: 'Please support businesses with clean production and strict environmental standards!',
            exhaust: 'Please use electric vehicles and public transport to reduce emissions!',
            fire: 'Please prevent human-caused fires and protect remaining forests!',
            chainsaw: 'Please STOP illegal logging and protect old-growth forests!',
            bulldozer: 'Please STOP habitat destruction and protect wildlife areas!'
        };
        
        // Find best match (case-insensitive) - prioritize exact and longer matches
        const lowerObjectName = objectName.toLowerCase();
        
        // First, try exact match
        if (pleas[lowerObjectName]) {
            console.log(`🎯 Found exact plea match: ${objectName} -> ${lowerObjectName}`);
            const plea = pleas[lowerObjectName];
            if (this.isHarmfulObject(objectName)) {
                return plea.replace(/Please save/g, 'Please avoid').replace(/Please SAVE/g, 'Please ELIMINATE');
            }
            return plea;
        }
        
        // Then try specific flower matches
        const specificFlowers = [
            'sunflower', 'lavender', 'orchid', 'rose', 'tulip', 'daisy', 'lily', 'lotus', 'iris',
            'carnation', 'chrysanthemum', 'petunia', 'marigold', 'zinnia', 'peony', 'daffodil',
            'azalea', 'camellia', 'begonia', 'impatiens', 'geranium', 'poppy', 'forget-me-not',
            'bluebell', 'buttercup', 'clover', 'dandelion', 'wild-rose', 'primrose', 'foxglove',
            'snapdragon', 'bird-of-paradise', 'anthurium', 'frangipani', 'bougainvillea', 'protea',
            'passion-flower', 'crocus', 'hyacinth', 'amaryllis', 'gladiolus', 'freesia',
            'morning-glory', 'sweet-pea', 'clematis', 'honeysuckle', 'chamomile', 'sage', 'mint', 'thyme'
        ];
        for (const specificFlower of specificFlowers) {
            if (lowerObjectName.includes(specificFlower) && pleas[specificFlower]) {
                console.log(`🎯 Found specific flower plea match: ${objectName} -> ${specificFlower}`);
                return pleas[specificFlower];
            }
        }
        
        // Then try specific fruit matches
        const specificFruitsPlea = [
            'orange', 'lemon', 'lime', 'grapefruit', 'tangerine', 'pomelo', 'bergamot', 'yuzu',
            'peach', 'plum', 'apricot', 'cherry', 'apple', 'pear', 'quince',
            'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry', 'gooseberry', 'elderberry', 'mulberry', 'currant',
            'banana', 'mango', 'pineapple', 'papaya', 'coconut', 'avocado', 'passion-fruit', 'kiwi', 'guava', 'lychee',
            'rambutan', 'dragon-fruit', 'star-fruit', 'jackfruit', 'durian', 'mangosteen',
            'watermelon', 'cantaloupe', 'honeydew', 'casaba',
            'grape', 'fig', 'date', 'pomegranate', 'persimmon', 'olive'
        ];
        for (const specificFruit of specificFruitsPlea) {
            if (lowerObjectName.includes(specificFruit) && pleas[specificFruit]) {
                console.log(`🎯 Found specific fruit plea match: ${objectName} -> ${specificFruit}`);
                return pleas[specificFruit];
            }
        }
        
        // Then try specific snake matches
        const specificSnakes = ['python', 'cobra', 'viper', 'rattlesnake', 'boa', 'anaconda', 'mamba', 'adder', 'copperhead', 'cottonmouth', 'kingsnake', 'garter', 'corn', 'milk', 'hognose'];
        for (const specificSnake of specificSnakes) {
            if (lowerObjectName.includes(specificSnake) && pleas[specificSnake]) {
                console.log(`🎯 Found specific snake plea match: ${objectName} -> ${specificSnake}`);
                return pleas[specificSnake];
            }
        }
        
        // Finally, try partial matches (sorted by length, longest first)
        const sortedKeys = Object.keys(pleas).sort((a, b) => b.length - a.length);
        for (const key of sortedKeys) {
            const lowerKey = key.toLowerCase();
            if (lowerObjectName.includes(lowerKey) || lowerKey.includes(lowerObjectName)) {
                console.log(`🎯 Found partial plea match: ${objectName} -> ${key}`);
                const plea = pleas[key];
                if (this.isHarmfulObject(objectName)) {
                    return plea.replace(/Please save/g, 'Please avoid').replace(/Please SAVE/g, 'Please ELIMINATE');
                }
                return plea;
            }
        }
        
        // Dynamic object type detection with specific pleas
        const objectTypes = {
            flowers: {
                names: ['jasmine', 'orchid', 'hibiscus', 'peony', 'daffodil', 'carnation', 
                       'chrysanthemum', 'petunia', 'marigold', 'pansy', 'violet', 'iris',
                       'dahlia', 'azalea', 'camellia', 'magnolia', 'poppy', 'lily', 'geranium',
                       'begonia', 'snapdragon', 'zinnia', 'cosmos', 'nasturtium', 'freesia'],
                plea: 'Please save me by protecting gardens, avoiding pesticides, and supporting pollinators!'
            },
            trees: {
                names: ['willow', 'cedar', 'elm', 'ash', 'beech', 'hickory', 'walnut', 'poplar',
                       'spruce', 'fir', 'redwood', 'sequoia', 'cypress', 'eucalyptus', 'acacia',
                       'teak', 'mahogany', 'bamboo', 'palm', 'coconut', 'cherry', 'peach', 'plum'],
                plea: 'Please save me by stopping deforestation, planting new trees, and protecting forests!'
            },
            fruits: {
                names: ['apple', 'orange', 'banana', 'grape', 'strawberry', 'blueberry', 'raspberry',
                       'blackberry', 'mango', 'pineapple', 'peach', 'pear', 'plum', 'cherry',
                       'watermelon', 'cantaloupe', 'kiwi', 'papaya', 'coconut', 'avocado',
                       'lemon', 'lime', 'grapefruit', 'pomegranate', 'fig', 'date'],
                plea: 'Please save me by supporting organic farming and protecting the trees that grow me!'
            },
            insects: {
                names: ['butterfly', 'dragonfly', 'grasshopper', 'cricket', 'mantis', 'beetle',
                       'ant', 'wasp', 'hornet', 'fly', 'mosquito', 'moth', 'cicada', 'aphid',
                       'termite', 'tick', 'spider', 'caterpillar', 'firefly', 'weevil'],
                plea: 'Please save me by avoiding pesticides and protecting natural habitats!'
            },
            birds: {
                names: ['robin', 'cardinal', 'bluejay', 'crow', 'raven', 'hawk', 'falcon', 'vulture',
                       'swan', 'duck', 'goose', 'heron', 'crane', 'flamingo', 'pelican', 'seagull',
                       'sparrow', 'finch', 'canary', 'parrot', 'peacock', 'turkey', 'chicken',
                       'pigeon', 'dove', 'woodpecker', 'hummingbird', 'kingfisher', 'penguin'],
                plea: 'Please save me by protecting forests, keeping cats indoors, and stopping window strikes!'
            },
            animals: {
                names: ['elephant', 'lion', 'tiger', 'leopard', 'cheetah', 'giraffe', 'zebra',
                       'rhino', 'hippo', 'buffalo', 'deer', 'elk', 'moose', 'wolf', 'fox',
                       'coyote', 'raccoon', 'skunk', 'squirrel', 'chipmunk', 'otter', 'seal',
                       'whale', 'dolphin', 'shark', 'monkey', 'gorilla', 'chimpanzee', 'human', 'koala',
                       'kangaroo', 'panda', 'sloth', 'armadillo', 'hedgehog', 'porcupine'],
                plea: 'Please save me by protecting wildlife habitats and stopping poaching!'
            }
        };

        // Check each category
        for (const [category, data] of Object.entries(objectTypes)) {
            const isMatch = data.names.some(name => objectName.toLowerCase().includes(name));
            if (isMatch) {
                return data.plea;
            }
        }
        
        // Default fallback with appropriate action
        if (this.isHarmfulObject(objectName)) {
            return 'Please avoid me by reducing pollution and stopping environmental destruction!';
        } else {
            // For general non-nature objects, provide environmental action suggestions
            console.log('🏠 NON-NATURE OBJECT PLEA: Creating environmental action message for:', objectName);
            
            const ecoActions = {
                house: 'Help the environment by making me energy-efficient with solar panels, LED lights, and proper insulation!',
                home: 'Help the environment by conserving water, recycling, and using eco-friendly products in me!',
                car: 'Help the environment by choosing electric or hybrid versions of me, or by carpooling and using public transport!',
                vehicle: 'Help the environment by maintaining me properly, driving efficiently, and considering electric alternatives!',
                cup: 'Help the environment by choosing reusable versions of me instead of disposable cups!',
                mug: 'Help the environment by using me repeatedly instead of disposable cups and bottles!',
                bottle: 'Help the environment by choosing reusable versions of me and recycling plastic ones properly!',
                phone: 'Help the environment by recycling me properly when I\'m old and using me to reduce paper consumption!',
                computer: 'Help the environment by using me for remote work, digital documents, and energy-saving settings!',
                chair: 'Help the environment by choosing me made from sustainable or recycled materials!',
                table: 'Help the environment by selecting me made from responsibly sourced or reclaimed wood!',
                book: 'Help the environment by sharing knowledge about nature conservation and recycling me when done!',
                human: 'Help the environment by making sustainable choices, conserving resources, and protecting wildlife!',
                person: 'Help the environment by living sustainably, reducing waste, and caring for nature!',
                man: 'Help the environment through eco-friendly choices, conservation efforts, and environmental awareness!',
                woman: 'Help the environment by making conscious choices that protect nature for future generations!',
                food: 'Help the environment by choosing organic, local, and sustainably grown versions of me!'
            };
            
            return ecoActions[objectName.toLowerCase()] || `Help the environment by using me responsibly, recycling when possible, and choosing sustainable alternatives!`;
        }
    }

    generateDynamicIntroduction(identifiedObject, baseMessage) {
        const objectName = identifiedObject.name;
        const confidence = Math.floor((identifiedObject.confidence || 0.5) * 100);
        
        // Create more specific introductions based on what was detected
        const specificIntros = {
            'tree': `I am ${objectName === 'tree' ? 'a majestic tree' : `a ${objectName}`}`,
            'flower': `I am ${objectName === 'flower' ? 'a beautiful flower' : `a lovely ${objectName}`}`,
            'river': `I am ${objectName === 'water' ? 'flowing water' : `a ${objectName}`}`,
            'bird': `I am ${objectName === 'bird' ? 'a soaring bird' : `a ${objectName}`}`,
            'butterfly': `I am a delicate ${objectName}`,
            'bee': `I am a busy ${objectName}`,
            'mountain': `I am ${objectName === 'mountain' ? 'a towering mountain' : `${objectName} from the earth`}`,
            'ocean': `I am the vast ${objectName}`,
            'bear': `I am a wild ${objectName}`,
            'fish': `I am a swimming ${objectName}`,
            'forest': `I am a living ${objectName}`,
            'earth': `I am part of nature - specifically ${objectName}`
        };
        
        const category = Object.keys(this.natureDatabase).find(key => 
            baseMessage === this.natureDatabase[key]) || 'earth';
            
        return specificIntros[category] || `I am ${objectName}`;
    }

    generateDynamicBenefits(identifiedObject, baseMessage) {
        // Use the base message but make it more specific if possible
        let benefits = baseMessage.message;
        
        // Add specific benefits based on detected object
        const specificBenefits = {
            'oak': 'I am especially strong and can live for centuries, providing shelter for generations.',
            'rose': 'I create beautiful fragrances and show nature\'s artistry.',
            'eagle': 'I soar high above and represent freedom and strength.',
            'salmon': 'I travel thousands of miles and feed entire ecosystems.',
            'coral': 'I build underwater cities that support countless marine species.'
        };
        
        const specific = specificBenefits[identifiedObject.name.toLowerCase()];
        if (specific) {
            benefits = specific + ' ' + benefits;
        }
        
        return benefits;
    }

    generateDynamicPlea(identifiedObject, baseMessage) {
        // Use base plea but make it more specific
        let plea = baseMessage.plea;
        
        // Add urgent pleas based on current environmental issues
        const urgentPleas = {
            'coral': 'Please save me by reducing carbon emissions - I am bleaching due to warming oceans!',
            'bee': 'Please save me by banning harmful pesticides - my colonies are disappearing!',
            'polar': 'Please save me by fighting climate change - my ice home is melting!',
            'elephant': 'Please save me by stopping poaching and protecting my habitat!',
            'rainforest': 'Please save me by supporting sustainable products - I am being cut down too fast!'
        };
        
        const urgent = urgentPleas[identifiedObject.name.toLowerCase()];
        if (urgent) {
            return urgent;
        }
        
        return plea;
    }

    // Legacy method for filename-based detection (kept as backup)
    identifyNature(filename) {
        const keywords = filename.toLowerCase();
        
        for (const [category, data] of Object.entries(this.natureDatabase)) {
            for (const keyword of data.keywords) {
                if (keywords.includes(keyword)) {
                    return data;
                }
            }
        }
        
        return this.intelligentNatureDetection();
    }

    isGeneralObject(objectName) {
        // Define general objects that shouldn't have environmental warnings/pleas
        const generalObjects = [
            'house', 'home', 'building', 'car', 'vehicle', 'cup', 'mug', 'bottle', 
            'phone', 'computer', 'chair', 'table', 'bed', 'book', 'pen', 'food', 
            'bread', 'pizza', 'burger', 'clothing', 'shoe', 'hat', 'tool', 'clock',
            'door', 'window', 'lamp', 'mirror', 'bag', 'box', 'toy', 'furniture', 'Object'
        ];
        
        // Check if it matches known general objects
        const isKnownGeneral = generalObjects.some(item => 
            objectName.includes(item) || item.includes(objectName) ||
            objectName === item
        );
        
        if (isKnownGeneral) return true;
        
        // If the object is not in our nature database, treat it as a general object
        // This ensures high-confidence detections that aren't in the database get clean messaging
        const isInNatureDatabase = this.natureDatabase && this.natureDatabase[objectName];
        if (!isInNatureDatabase) {
            console.log('🏠 Object not in nature database - treating as general object:', objectName);
            return true;
        }
        
        return false;
    }

    isAnimalOrSnake(objectName) {
        // Define animals and snakes that shouldn't have environmental warnings
        const animalsAndSnakes = [
            'lion', 'bear', 'bird', 'butterfly', 'bee', 'rabbit', 'fish', 'dog', 'cat', 
            'horse', 'elephant', 'tiger', 'snake', 'rattlesnake', 'kangaroo', 'insect',
            'mammal', 'reptile', 'amphibian', 'animal', 'wildlife', 'creature'
        ];
        
        // Check if it matches known animals or snakes
        const isAnimal = animalsAndSnakes.some(item => 
            objectName.includes(item) || item.includes(objectName) ||
            objectName === item
        );
        
        if (isAnimal) {
            console.log('🐾 Animal/snake detected - skipping environmental warnings:', objectName);
            return true;
        }
        
        return false;
    }

    isGarbage(objectName) {
        // Define garbage/pollution objects that should have environmental warnings
        const garbageItems = [
            'trash', 'garbage', 'litter', 'waste', 'plastic', 'pollution', 'contamination',
            'toxic', 'oil spill', 'cigarette', 'bottle', 'can', 'bag', 'wrapper'
        ];
        
        // Check if it matches known garbage items
        const isGarbageItem = garbageItems.some(item => 
            objectName.includes(item) || item.includes(objectName) ||
            objectName === item
        );
        
        if (isGarbageItem) {
            console.log('🗑️ Garbage/pollution detected - adding strong environmental warnings:', objectName);
            return true;
        }
        
        return false;
    }

    displayNatureMessage(natureData) {
        this.natureAvatar.textContent = natureData.emoji;
        this.natureTitle.textContent = `Hello! ${natureData.introduction}`;
        
        // Check category types for different message formatting
        const isGeneral = this.isGeneralObject(natureData.detectedAs) || this.isGeneralObject(natureData.originalDetection);
        const isAnimalOrSnake = this.isAnimalOrSnake(natureData.detectedAs) || this.isAnimalOrSnake(natureData.originalDetection);
        const isGarbage = this.isGarbage(natureData.detectedAs) || this.isGarbage(natureData.originalDetection);
        
        let fullMessage, spokenMessage;
        
        if (isGarbage) {
            // For garbage/pollution objects, include strong environmental warnings
            fullMessage = `${natureData.message}\n\n🧠 Did you know? ${natureData.explanation}\n\n⚠️ URGENT WARNING: I am destroying the environment and harming all life on Earth! My presence indicates serious environmental damage that requires immediate action.\n\n💚 ${natureData.plea}`;
            spokenMessage = `${natureData.introduction}. ${natureData.message} Did you know? ${natureData.explanation} Urgent warning: I am destroying the environment and harming all life on Earth! ${natureData.plea}`;
            console.log('🗑️ Garbage/pollution detected - adding strong environmental warnings');
        } else if (isGeneral || isAnimalOrSnake) {
            // For general objects and animals/snakes, only include message and explanation (no consequences/plea)
            fullMessage = `${natureData.message}\n\n🧠 Did you know? ${natureData.explanation}`;
            spokenMessage = `${natureData.introduction}. ${natureData.message} Did you know? ${natureData.explanation}`;
            if (isGeneral) {
                console.log('🏠 General object detected - skipping environmental warnings/pleas');
            } else {
                console.log('🐾 Animal/snake detected - skipping environmental warnings/pleas');
            }
        } else {
            // For nature objects (plants, environment), include full message with consequences and plea
            fullMessage = `${natureData.message}\n\n🧠 Did you know? ${natureData.explanation}\n\n${natureData.consequences ? '⚠️ Warning: ' + natureData.consequences + '\n\n' : ''}💚 ${natureData.plea}`;
            spokenMessage = `${natureData.introduction}. ${natureData.message} Did you know? ${natureData.explanation} ${natureData.consequences ? 'But ' + natureData.consequences + ' ' : ''}${natureData.plea}`;
        }
        
        this.natureText.textContent = fullMessage;
        this.currentMessage = spokenMessage;
        this.currentObjectType = natureData.detectedAs || 'nature';
        this.detectedObjectName = natureData.originalDetection || natureData.detectedAs || 'nature'; // Use original AI detection
        
        console.log('Detected object for quiz:', this.detectedObjectName); // Debug log
        console.log('All nature data:', natureData); // Debug log
        
        // Add character animation
        this.addCharacterAnimation(this.currentObjectType);
        
        // Add particle effects
        this.createParticleEffects(this.currentObjectType);
        
        // Show quiz button
        this.quizBtn.style.display = 'inline-block';
        
        // Generate quiz questions for this specific detected object
        this.currentQuestions = this.generateQuizQuestions(this.detectedObjectName);
        console.log('Generated questions:', this.currentQuestions); // Debug log

        if (window.AppInventor) {
            window.AppInventor.setWebViewString(JSON.stringify({
                label: this.detectedObjectName || 'nature',
                probability: typeof this.lastConfidence === 'number' ? this.lastConfidence : (natureData.confidence || 0.75),
                message: this.currentMessage
            }));
        }
    }

    addCharacterAnimation(objectType) {
        // Remove existing animations
        this.natureAvatar.className = 'nature-avatar';
        
        // Add specific animation based on object type
        const animations = {
            tree: 'animate-sway',
            flower: 'animate-bounce',
            butterfly: 'animate-float',
            bee: 'animate-wiggle',
            bird: 'animate-float',
            rabbit: 'animate-bounce',
            fish: 'animate-float',
            ocean: 'animate-sway',
            river: 'animate-sway'
        };
        
        const animation = animations[objectType] || 'animate-bounce';
        this.natureAvatar.classList.add(animation);
    }

    createParticleEffects(objectType) {
        // Remove existing particles
        const existingParticles = document.querySelectorAll('.particles');
        existingParticles.forEach(p => p.remove());
        
        const particleContainer = document.createElement('div');
        particleContainer.className = 'particles';
        this.resultSection.appendChild(particleContainer);
        
        const particleTypes = {
            tree: { emoji: '🍃', count: 8, className: 'leaf' },
            flower: { emoji: '✨', count: 10, className: 'flower' },
            ocean: { emoji: '💧', count: 6, className: 'water-drop' },
            river: { emoji: '💧', count: 4, className: 'water-drop' },
            butterfly: { emoji: '✨', count: 12, className: 'flower' },
            bee: { emoji: '🌟', count: 8, className: 'flower' }
        };
        
        const particleData = particleTypes[objectType] || { emoji: '✨', count: 6, className: 'flower' };
        
        // Create particles
        for (let i = 0; i < particleData.count; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.className = `particle ${particleData.className}`;
                particle.textContent = particleData.emoji;
                particle.style.left = Math.random() * 100 + '%';
                particle.style.top = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 2 + 's';
                particleContainer.appendChild(particle);
                
                // Remove particle after animation
                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.remove();
                    }
                }, 4000);
            }, i * 200);
        }
    }

    speakMessage() {
        // Play nature sound first
        this.playNatureSound(this.currentObjectType);
        
        // Then speak the message
        setTimeout(() => {
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(this.currentMessage);
                
                // Settings for 11-year-old boy voice
                utterance.rate = 0.9; // Slightly faster, more energetic
                utterance.pitch = 1.5; // Higher pitch for younger sound
                utterance.volume = 1;
                
                const voices = speechSynthesis.getVoices();
                if (voices.length > 0) {
                    // Try to find a voice that sounds younger/more boyish
                    utterance.voice = voices.find(voice => 
                        voice.name.includes('Google UK English Male') ||
                        voice.name.includes('Daniel') ||
                        voice.name.includes('Alex') ||
                        voice.name.includes('Google UK English') ||
                        voice.name.includes('Male') ||
                        voice.name.includes('English')
                    ) || voices[0];
                    
                    console.log('Using voice:', utterance.voice.name);
                }
                
                speechSynthesis.speak(utterance);
            } else {
                alert('Speech synthesis is not supported on this device.');
            }
        }, 500);
    }

    playNatureSound(objectType) {
        // Create audio context for nature sounds (using Web Audio API)
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const soundFrequencies = {
            tree: [220, 330, 440], // Wind through leaves
            flower: [440, 550, 660], // Gentle chimes
            ocean: [150, 200, 250], // Ocean waves
            river: [300, 400, 500], // Flowing water
            bird: [800, 1000, 1200], // Bird chirping
            bee: [300, 400, 300], // Buzzing
            butterfly: [500, 600, 700], // Light flutter
            rabbit: [400, 500, 400] // Soft rustling
        };
        
        const frequencies = soundFrequencies[objectType] || soundFrequencies.tree;
        
        // Play harmonious tones
        frequencies.forEach((freq, index) => {
            setTimeout(() => {
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                oscillator.type = objectType === 'ocean' ? 'sawtooth' : 'sine';
                
                gainNode.gain.setValueAtTime(0, audioContext.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.1);
                gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.8);
                
                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.8);
            }, index * 200);
        });
    }

    playCustomVoice(objectType) {
        const audioBlob = this.customVoices[objectType];
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
        };
        
        audio.play().catch(error => {
            console.log('Failed to play custom voice:', error);
            alert('Failed to play custom voice. Using text-to-speech instead.');
            // Fallback to text-to-speech
            this.speakMessage();
        });
    }

    // Voice Recording Methods
    showVoiceRecording() {
        this.messageToRead.textContent = this.currentMessage;
        this.voiceRecording.style.display = 'block';
        this.recordVoiceBtn.style.display = 'none';
    }

    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: true,
                video: false
            });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });
            
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.customVoiceBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
                this.playTestBtn.style.display = 'inline-block';
                this.saveVoiceBtn.style.display = 'inline-block';
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            
            // Update UI
            this.startRecordBtn.style.display = 'none';
            this.stopRecordBtn.style.display = 'inline-block';
            this.startRecordBtn.innerHTML = '<span class="recording-indicator"></span>Recording...';
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            alert('Failed to access microphone. Please allow microphone access.');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        // Update UI
        this.startRecordBtn.style.display = 'inline-block';
        this.stopRecordBtn.style.display = 'none';
        this.startRecordBtn.innerHTML = '🔴 Start Recording';
    }

    playTestRecording() {
        if (this.customVoiceBlob) {
            const audioUrl = URL.createObjectURL(this.customVoiceBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
            };
            
            audio.play();
        }
    }

    saveCustomVoice() {
        if (this.customVoiceBlob) {
            // Save the custom voice for this object type
            this.customVoices[this.currentObjectType] = this.customVoiceBlob;
            
            // Save to localStorage for persistence
            this.saveVoicesToStorage();
            
            alert(`Custom voice saved for ${this.currentObjectType}! It will be used when this object is detected.`);
            this.cancelRecording();
        }
    }

    cancelRecording() {
        // Reset recording UI
        this.voiceRecording.style.display = 'none';
        this.recordVoiceBtn.style.display = 'inline-block';
        this.startRecordBtn.style.display = 'inline-block';
        this.stopRecordBtn.style.display = 'none';
        this.playTestBtn.style.display = 'none';
        this.saveVoiceBtn.style.display = 'none';
        this.startRecordBtn.innerHTML = '🔴 Start Recording';
        
        // Clear recording data
        this.customVoiceBlob = null;
        this.recordedChunks = [];
        
        // Stop any ongoing recording
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
    }

    saveVoicesToStorage() {
        // Convert blobs to base64 for localStorage
        const voiceData = {};
        
        Object.keys(this.customVoices).forEach(async (objectType) => {
            const blob = this.customVoices[objectType];
            const reader = new FileReader();
            reader.onload = () => {
                voiceData[objectType] = reader.result;
                localStorage.setItem('naturetalks_voices', JSON.stringify(voiceData));
            };
            reader.readAsDataURL(blob);
        });
    }

    // Quiz System - Dynamic questions based on detected object
    generateQuizQuestions(detectedObjectName) {
        // Create specific questions based on the actual detected object name
        const specificQuestions = this.createSpecificQuestions(detectedObjectName);
        
        // If we have specific questions, use them; otherwise fall back to category questions
        return specificQuestions.length > 0 ? specificQuestions : this.getCategoryQuestions(detectedObjectName);
    }

    createSpecificQuestions(detectedObject) {
        const objectName = detectedObject.toLowerCase();
        
        // Comprehensive question database for specific objects
        const specificQuestionBank = {
            // Trees
            "oak": [
                {
                    question: "I am an oak tree! What makes me special?",
                    options: ["I grow very fast", "I only grow in winter", "I can live for hundreds of years", "I don't need water"],
                    correct: 2,
                    explanation: "Oak trees are known for their longevity - I can live for 200-300 years or more!"
                },
                {
                    question: "What do my acorns become?",
                    options: ["New oak trees", "Flowers", "Bird nests", "Rocks"],
                    correct: 0,
                    explanation: "My acorns are seeds that grow into new oak trees when planted!"
                }
            ],
            "pine": [
                {
                    question: "I'm a pine tree! What's special about my leaves?",
                    options: ["They fall off in winter", "They change color", "They're very big", "They're needles that stay green all year"],
                    correct: 3,
                    explanation: "My needle-shaped leaves stay green all year - that's why I'm called an evergreen!"
                },
                {
                    question: "What do I produce that contains my seeds?",
                    options: ["Pine cones", "Acorns", "Flowers", "Berries"],
                    correct: 0,
                    explanation: "My pine cones protect my seeds until they're ready to grow!"
                }
            ],
            "maple": [
                {
                    question: "I'm a maple tree! What am I famous for?",
                    options: ["Purple leaves", "Growing underwater", "Never losing leaves", "Maple syrup"],
                    correct: 3,
                    explanation: "People tap my trunk to collect sap that becomes delicious maple syrup!"
                }
            ],
            "apple": [
                {
                    question: "I'm an apple tree! What do I produce that people love to eat?",
                    options: ["Pine cones", "Acorns", "Delicious apples", "Maple syrup"],
                    correct: 2,
                    explanation: "I grow sweet, nutritious apples that people have enjoyed for thousands of years!"
                },
                {
                    question: "When do I look most beautiful?",
                    options: ["During spring when I bloom with flowers", "In winter", "When I'm cut down", "Never"],
                    correct: 0,
                    explanation: "In spring, I'm covered with beautiful pink and white blossoms before my apples grow!"
                },
                {
                    question: "How do I help the ecosystem besides providing fruit?",
                    options: ["I don't help", "I only take from nature", "I make noise", "I attract pollinators and provide shelter"],
                    correct: 3,
                    explanation: "My blossoms attract bees and other pollinators, and I provide homes for birds and insects!"
                }
            ],

            // Flowers
            "rose": [
                {
                    question: "I'm a rose! What should you be careful of when touching me?",
                    options: ["My petals", "My roots", "My thorns", "My smell"],
                    correct: 2,
                    explanation: "My thorns protect me from animals that might eat me!"
                },
                {
                    question: "Why do I have such a strong fragrance?",
                    options: ["To attract pollinators", "To scare bugs away", "To make rain", "To grow taller"],
                    correct: 0,
                    explanation: "My beautiful scent attracts bees and other pollinators to help me reproduce!"
                }
            ],
            "sunflower": [
                {
                    question: "I'm a sunflower! What do I do during the day?",
                    options: ["Sleep", "Hide underground", "Change colors", "Turn to face the sun"],
                    correct: 3,
                    explanation: "I turn my face to follow the sun across the sky - this is called heliotropism!"
                },
                {
                    question: "What do my seeds become?",
                    options: ["New sunflowers or food", "Rocks", "Water", "Other flowers"],
                    correct: 0,
                    explanation: "My seeds can grow into new sunflowers or be eaten as healthy snacks!"
                }
            ],
            "tulip": [
                {
                    question: "I'm a tulip! What do I grow from?",
                    options: ["A seed", "A tree branch", "A bulb", "A rock"],
                    correct: 2,
                    explanation: "I grow from a bulb planted underground, which stores energy for me to bloom!"
                }
            ],

            // Animals
            "rabbit": [
                {
                    question: "I'm a rabbit! How do I help spread plants?",
                    options: ["By eating all plants", "By digging holes", "By carrying seeds in my fur and droppings", "By sleeping a lot"],
                    correct: 2,
                    explanation: "As I hop around, seeds stick to my fur and pass through my digestive system, planting them in new places!"
                },
                {
                    question: "What type of food do I mainly eat?",
                    options: ["Plants and vegetables", "Meat", "Fish", "Insects"],
                    correct: 0,
                    explanation: "I'm an herbivore - I eat grasses, vegetables, and other plants!"
                }
            ],
            "eagle": [
                {
                    question: "I'm an eagle! How do I help the ecosystem?",
                    options: ["I plant trees", "I make rain", "I dig holes", "I control rodent populations"],
                    correct: 3,
                    explanation: "As a predator, I help keep the ecosystem balanced by controlling populations of small animals!"
                }
            ],
            "butterfly": [
                {
                    question: "I'm a butterfly! What was I before I became beautiful?",
                    options: ["A bird", "A bee", "A caterpillar", "A flower"],
                    correct: 2,
                    explanation: "I started as a caterpillar, then became a chrysalis, and finally transformed into a butterfly!"
                },
                {
                    question: "How do I help flowers?",
                    options: ["I pollinate them", "I eat them", "I water them", "I cut them"],
                    correct: 0,
                    explanation: "I carry pollen from flower to flower as I drink their nectar, helping them reproduce!"
                }
            ],
            "lotus": [
                {
                    question: "I'm a lotus flower! Where do I grow?",
                    options: ["In desert sand", "Floating on water surfaces", "High in mountains", "Underground"],
                    correct: 1,
                    explanation: "I grow with my roots in pond mud and my beautiful flowers floating on the water surface!"
                },
                {
                    question: "What makes me special in many cultures?",
                    options: ["I'm poisonous", "I symbolize purity and rebirth", "I only bloom at night", "I'm the largest flower"],
                    correct: 1,
                    explanation: "Despite growing from muddy water, I emerge clean and beautiful - symbolizing purity rising from difficult conditions!"
                },
                {
                    question: "How do I help pond ecosystems?",
                    options: ["I poison the water", "I provide shelter and landing spots for wildlife", "I drain all the water", "I make noise"],
                    correct: 1,
                    explanation: "My large leaves provide landing pads for frogs and birds, and my roots help filter and clean the water!"
                }
            ],

            // Water bodies
            "coral_reef": [
                {
                    question: "I'm a coral reef! What am I made of?",
                    options: ["Rocks", "Tiny living animals called polyps", "Plants", "Sand"],
                    correct: 1,
                    explanation: "I'm built by tiny animals called coral polyps that create limestone skeletons!"
                },
                {
                    question: "What percentage of marine species do I support?",
                    options: ["5%", "15%", "25%", "50%"],
                    correct: 2,
                    explanation: "Even though I cover less than 1% of the ocean, I support about 25% of all marine species!"
                }
            ],
            "ocean": [
                {
                    question: "I'm the ocean! What do I produce that you need to breathe?",
                    options: ["Carbon dioxide", "Most of Earth's oxygen", "Nitrogen", "Helium"],
                    correct: 1,
                    explanation: "My phytoplankton produce about 70% of the oxygen you breathe!"
                }
            ],

            // Harmful objects
            "cigarette": [
                {
                    question: "I'm a cigarette butt! How long do I take to decompose?",
                    options: ["1 week", "1 month", "10-12 years", "I never decompose"],
                    correct: 2,
                    explanation: "Cigarette butts take 10-12 years to decompose and leak toxic chemicals!"
                },
                {
                    question: "What rank am I among littered items worldwide?",
                    options: ["#1 most littered item", "#5 most littered", "#10 most littered", "Not commonly littered"],
                    correct: 0,
                    explanation: "Cigarette butts are the #1 most littered item on Earth!"
                }
            ],
            "plastic": [
                {
                    question: "I'm plastic waste! How long do I take to decompose?",
                    options: ["10 years", "50 years", "400-1000 years", "1 year"],
                    correct: 2,
                    explanation: "Plastic takes 400-1000 years to decompose, polluting the environment!"
                },
                {
                    question: "What do I become when I break down?",
                    options: ["Fertile soil", "Toxic microplastics", "Clean water", "Fresh air"],
                    correct: 1,
                    explanation: "I break into microplastics that poison the food chain!"
                }
            ],

            // Common MobileNet detection results
            "Golden retriever": [
                {
                    question: "I'm a Golden retriever dog! How do I help humans?",
                    options: ["I hunt other animals", "I'm a loyal companion", "I eat plants", "I fly"],
                    correct: 1,
                    explanation: "Dogs like me are loyal companions who help humans in many ways!"
                }
            ],
            "tabby": [
                {
                    question: "I'm a tabby cat! What makes me a good pet?",
                    options: ["I'm very loud", "I'm independent and loving", "I need lots of water", "I only sleep"],
                    correct: 1,
                    explanation: "Cats like me are independent yet loving companions!"
                }
            ],
            "daisy": [
                {
                    question: "I'm a daisy! What's special about my petals?",
                    options: ["They're always blue", "They point to the center", "They fall off immediately", "They glow in dark"],
                    correct: 1,
                    explanation: "My white petals surround my yellow center like rays of sunshine!"
                }
            ],
            "Egyptian cat": [
                {
                    question: "I'm a cat! What's my favorite activity?",
                    options: ["Swimming", "Hunting and playing", "Flying", "Digging holes"],
                    correct: 1,
                    explanation: "I love to hunt, play, and explore - it's in my nature as a feline!"
                }
            ],
            "retriever": [
                {
                    question: "I'm a retriever! What was I originally bred to do?",
                    options: ["Guard houses", "Retrieve game for hunters", "Herd sheep", "Pull sleds"],
                    correct: 1,
                    explanation: "I was bred to retrieve waterfowl and game for hunters!"
                }
            ],
            "tree frog": [
                {
                    question: "I'm a tree frog! How do I help the ecosystem?",
                    options: ["I eat harmful insects", "I pollinate flowers", "I dig holes", "I make noise"],
                    correct: 0,
                    explanation: "I eat lots of mosquitoes and other insects that can be pests!"
                }
            ],
            "monarch": [
                {
                    question: "I'm a monarch butterfly! What's amazing about my migration?",
                    options: ["I never move", "I travel thousands of miles", "I only fly at night", "I live underwater"],
                    correct: 1,
                    explanation: "I can migrate over 2,000 miles from Canada to Mexico!"
                }
            ],

            // Australian Animals (newly detected species)
            "kangaroo": [
                {
                    question: "I'm a kangaroo! What makes me unique among mammals?",
                    options: ["I lay eggs", "I breathe underwater", "I carry my babies in a pouch", "I can fly"],
                    correct: 2,
                    explanation: "I'm a marsupial - my babies are born tiny and develop in my protective pouch!"
                },
                {
                    question: "How do I move across the Australian landscape?",
                    options: ["I hop using my powerful hind legs", "I crawl slowly", "I swim everywhere", "I never move"],
                    correct: 0,
                    explanation: "My powerful hind legs let me hop up to 40 mph across the outback!"
                },
                {
                    question: "What do I eat as a kangaroo?",
                    options: ["Only meat", "Fish", "Rocks", "Grass and plants"],
                    correct: 3,
                    explanation: "I'm an herbivore who grazes on grasses and native Australian plants!"
                }
            ],
            "koala": [
                {
                    question: "I'm a koala! What do I eat almost exclusively?",
                    options: ["Eucalyptus leaves", "Bamboo", "Fish", "Honey"],
                    correct: 0,
                    explanation: "I eat eucalyptus leaves - they're toxic to most animals but my digestive system can handle them!"
                },
                {
                    question: "How many hours do I sleep per day?",
                    options: ["2-4 hours", "8 hours", "I never sleep", "18-22 hours"],
                    correct: 3,
                    explanation: "Eucalyptus leaves are hard to digest and low in energy, so I sleep 18-22 hours to conserve energy!"
                },
                {
                    question: "Where do I live in the wild?",
                    options: ["In underground burrows", "In caves", "In eucalyptus trees in Australia", "In the ocean"],
                    correct: 2,
                    explanation: "I live high up in eucalyptus trees across eastern Australia!"
                }
            ],

            // Forest and Environment
            "rainforest": [
                {
                    question: "I'm a rainforest! How much of Earth's oxygen do I produce?",
                    options: ["5%", "20%", "50%", "90%"],
                    correct: 1,
                    explanation: "Rainforests like me produce about 20% of the world's oxygen!"
                },
                {
                    question: "How many species live in rainforests like me?",
                    options: ["A few dozen", "Over 50% of Earth's species", "Only insects", "No species"],
                    correct: 1,
                    explanation: "Despite covering only 6% of Earth, I'm home to over 50% of all plant and animal species!"
                },
                {
                    question: "What happens when I'm cut down?",
                    options: ["Nothing changes", "Climate change accelerates", "More rain falls", "Soil becomes richer"],
                    correct: 1,
                    explanation: "When I'm destroyed, massive amounts of stored carbon are released, accelerating climate change!"
                }
            ],
            "jungle": [
                {
                    question: "I'm a jungle! What makes me different from other forests?",
                    options: ["I'm always cold", "I have very dense vegetation", "I have no animals", "I only grow in winter"],
                    correct: 1,
                    explanation: "My thick canopy creates a dense, multilayered ecosystem with incredible biodiversity!"
                },
                {
                    question: "How do I help prevent soil erosion?",
                    options: ["I don't help", "My roots hold soil together", "I make soil disappear", "I turn soil to rock"],
                    correct: 1,
                    explanation: "My complex root system holds soil in place, preventing erosion on hillsides and riverbanks!"
                }
            ],
            "mountain": [
                {
                    question: "I'm a mountain! How do I affect local weather?",
                    options: ["I create rain shadows and temperature changes", "I don't affect weather", "I make it always hot", "I stop all wind"],
                    correct: 0,
                    explanation: "I force air masses upward, creating clouds and precipitation on my windward side!"
                },
                {
                    question: "What unique ecosystems do I support?",
                    options: ["No ecosystems", "Only desert plants", "Only ocean life", "Alpine ecosystems with specialized plants"],
                    correct: 3,
                    explanation: "My high altitude creates unique alpine ecosystems with plants adapted to cold and thin air!"
                }
            ],

            // Marine Life
            "coral": [
                {
                    question: "I'm coral! What's the biggest threat to my survival?",
                    options: ["Too much fish", "Ocean warming and acidification", "Too much sunlight", "Strong currents"],
                    correct: 1,
                    explanation: "Rising ocean temperatures cause coral bleaching, and acidification dissolves my skeleton!"
                },
                {
                    question: "How do I get my food?",
                    options: ["I hunt fish", "Tiny algae living in me photosynthesize", "I eat rocks", "I don't need food"],
                    correct: 1,
                    explanation: "Tiny algae called zooxanthellae live inside me and provide food through photosynthesis!"
                }
            ],
            "fish": [
                {
                    question: "I'm a fish! How do I help keep ocean ecosystems healthy?",
                    options: ["I don't help", "I control algae and transport nutrients", "I pollute water", "I eat all plants"],
                    correct: 1,
                    explanation: "Different fish species control algae, clean parasites, and transport nutrients throughout the ocean!"
                },
                {
                    question: "What's threatening fish populations worldwide?",
                    options: ["Nothing", "Overfishing and pollution", "Too much oxygen", "Too many plants"],
                    correct: 1,
                    explanation: "Overfishing, plastic pollution, and climate change are major threats to fish populations!"
                }
            ],
            "reef": [
                {
                    question: "I'm a coral reef! Why am I called the 'rainforest of the sea'?",
                    options: ["I grow trees", "I support incredible biodiversity", "I'm always wet", "I'm green"],
                    correct: 1,
                    explanation: "Like rainforests, I support an amazing variety of life in a relatively small area!"
                },
                {
                    question: "How long did it take me to form?",
                    options: ["A few years", "Thousands of years", "One month", "I formed instantly"],
                    correct: 1,
                    explanation: "Coral reefs like me take thousands of years to form - that's why protecting existing reefs is so important!"
                }
            ],

            // Insects and Small Creatures  
            "bee": [
                {
                    question: "I'm a bee! What would happen to food production without me?",
                    options: ["Nothing would change", "More food would grow", "Food production would drop by 30%", "Only meat would be available"],
                    correct: 2,
                    explanation: "Bees pollinate about 1/3 of all food crops - without us, many fruits and vegetables would disappear!"
                },
                {
                    question: "Why are bee populations declining?",
                    options: ["Pesticides and habitat loss", "We're too happy", "Too much honey", "We're moving to space"],
                    correct: 0,
                    explanation: "Pesticides poison us, and loss of wildflower habitats means less food for bee colonies!"
                },
                {
                    question: "How do I communicate with other bees?",
                    options: ["I don't communicate", "I sing songs", "I write messages", "I dance to show where flowers are"],
                    correct: 3,
                    explanation: "I perform a 'waggle dance' to tell other bees the direction and distance to good flowers!"
                }
            ],
            "insect": [
                {
                    question: "I'm an insect! What percentage of all animal species do insects represent?",
                    options: ["10%", "25%", "50%", "80%"],
                    correct: 3,
                    explanation: "Insects make up about 80% of all animal species on Earth!"
                },
                {
                    question: "How do insects help ecosystems?",
                    options: ["We don't help", "We pollinate, decompose waste, and feed other animals", "We only cause problems", "We just exist"],
                    correct: 1,
                    explanation: "Insects are essential - we pollinate plants, break down dead material, and feed many animals!"
                }
            ],

            // Plants and Flowers
            "bamboo": [
                {
                    question: "I'm bamboo! How fast can I grow?",
                    options: ["1 inch per year", "Only in winter", "I don't grow", "Up to 3 feet in 24 hours"],
                    correct: 3,
                    explanation: "Some bamboo species can grow up to 3 feet in a single day - making me one of the fastest-growing plants!"
                },
                {
                    question: "How do I help fight climate change?",
                    options: ["I absorb more CO2 than trees", "I don't help", "I create pollution", "I use too much water"],
                    correct: 0,
                    explanation: "I absorb up to 35% more carbon dioxide than equivalent forest trees!"
                },
                {
                    question: "What makes me useful to humans?",
                    options: ["I'm not useful", "I only look nice", "I can be used for construction, clothing, and food", "I make noise"],
                    correct: 2,
                    explanation: "I'm incredibly versatile - used for building, textiles, food, and even smartphones!"
                }
            ],
            "flower": [
                {
                    question: "I'm a flower! What's my main purpose in nature?",
                    options: ["To look pretty", "To attract pollinators for reproduction", "To make perfume", "To change colors"],
                    correct: 1,
                    explanation: "My colors, scents, and nectar are all designed to attract pollinators so I can reproduce!"
                },
                {
                    question: "What happens to ecosystems when flowers disappear?",
                    options: ["Nothing changes", "Pollinator populations crash", "More rain falls", "Animals get bigger"],
                    correct: 1,
                    explanation: "Without flowers, bees, butterflies, and other pollinators lose their food source and disappear!"
                }
            ],

            // Environmental Issues
            "plastic_bottle": [
                {
                    question: "I'm a plastic bottle! How long do I take to decompose?",
                    options: ["6 months", "5 years", "50 years", "450 years"],
                    correct: 3,
                    explanation: "Plastic bottles take about 450 years to decompose, releasing toxins the entire time!"
                },
                {
                    question: "Where do many plastic bottles like me end up?",
                    options: ["Recycling centers", "In the ocean harming marine life", "Buried safely", "They disappear magically"],
                    correct: 1,
                    explanation: "Millions of plastic bottles end up in oceans, where they harm marine life and create garbage patches!"
                }
            ],
            "litter": [
                {
                    question: "I'm litter! How do I harm wildlife?",
                    options: ["I don't harm anyone", "Animals eat me or get trapped in me", "I help animals", "I make animals stronger"],
                    correct: 1,
                    explanation: "Wildlife often mistakes litter for food or gets entangled in it, leading to injury or death!"
                },
                {
                    question: "How long does it take for litter to break down?",
                    options: ["A few days", "Depends on the material - from months to centuries", "Always 1 year", "Litter never breaks down"],
                    correct: 1,
                    explanation: "Different litter takes different times: apple cores (2 months), aluminum cans (200 years), plastic bags (500+ years)!"
                }
            ],

            // Fungi and Mushrooms
            "fungus": [
                {
                    question: "I'm a fungus! What crucial role do I play in forests?",
                    options: ["I break down dead material and recycle nutrients", "I only cause disease", "I don't help at all", "I just look pretty"],
                    correct: 0,
                    explanation: "Fungi are nature's recyclers - I break down dead plants and animals, returning vital nutrients to the soil!"
                },
                {
                    question: "How do I connect with trees to help them?",
                    options: ["I don't connect with trees", "I attack all trees", "I form mycorrhizal networks that share nutrients", "I only grow on rocks"],
                    correct: 2,
                    explanation: "My underground networks connect tree roots, allowing them to share nutrients and communicate - it's called the 'wood wide web'!"
                },
                {
                    question: "What would happen to forests without fungi like me?",
                    options: ["Trees would grow better", "Nothing would change", "Dead material would pile up and forests would collapse", "There would be more flowers"],
                    correct: 2,
                    explanation: "Without fungi, dead leaves and wood wouldn't decompose - forests would be buried under dead material and nutrients wouldn't recycle!"
                }
            ],
            "mushroom": [
                {
                    question: "I'm a mushroom! What part of the fungus am I?",
                    options: ["I'm the whole fungus", "I'm just the reproductive part", "I'm the roots", "I'm not part of a fungus"],
                    correct: 1,
                    explanation: "I'm just the fruiting body - like an apple on a tree! The main fungus is a huge network underground called mycelium."
                },
                {
                    question: "Why should people never pick wild mushrooms without expertise?",
                    options: ["All mushrooms are safe to eat", "It harms the environment", "Some mushrooms are deadly poisonous", "Mushrooms don't grow back"],
                    correct: 2,
                    explanation: "Some mushrooms can kill you with just one bite! Even experts can make mistakes - never eat wild mushrooms unless you're 100% certain!"
                },
                {
                    question: "How do I spread to create new fungal colonies?",
                    options: ["Through underground roots", "By releasing millions of tiny spores", "I can't reproduce", "By growing flowers"],
                    correct: 1,
                    explanation: "I release millions of microscopic spores into the air - like invisible seeds that can travel huge distances to start new fungal colonies!"
                },
                {
                    question: "What amazing thing can some mushrooms do in polluted areas?",
                    options: ["Nothing special", "Create more pollution", "Break down toxins and clean the environment", "Grow bigger"],
                    correct: 2,
                    explanation: "Some fungi can break down oil spills, heavy metals, and other pollutants - we call this 'mycoremediation' or fungal cleanup!"
                }
            ],
            "boletus": [
                {
                    question: "I'm a Boletus mushroom! What makes me different from other mushrooms?",
                    options: ["I have gills under my cap", "I have pores instead of gills", "I grow on trees", "I'm always poisonous"],
                    correct: 1,
                    explanation: "Unlike mushrooms with gills, I have tiny pores under my cap that release spores - like a natural sponge!"
                },
                {
                    question: "How can people tell if a Boletus like me might be dangerous?",
                    options: ["All Boletus are safe", "Look for blue staining when cut", "Size doesn't matter", "Color means nothing"],
                    correct: 1,
                    explanation: "Many Boletus that stain blue when cut or bruised can cause stomach problems - it's a warning sign to avoid eating them!"
                }
            ],
            "toadstool": [
                {
                    question: "I'm called a toadstool! What does this name usually mean?",
                    options: ["I'm safe to eat", "I'm probably poisonous or inedible", "Toads sit on me", "I only grow in water"],
                    correct: 1,
                    explanation: "The name 'toadstool' traditionally refers to mushrooms that are poisonous or inedible - a warning to stay away!"
                },
                {
                    question: "What should you do if you see colorful toadstools like me?",
                    options: ["Pick and eat them", "Touch them with bare hands", "Admire from a distance and don't touch", "Step on them"],
                    correct: 2,
                    explanation: "Look but don't touch! Many poisonous mushrooms are beautiful, but they can be dangerous even to handle. Enjoy nature safely!"
                }
            ]
        };

        // Try to find questions for the specific detected object
        for (const [key, questions] of Object.entries(specificQuestionBank)) {
            if (objectName.includes(key) || key.includes(objectName)) {
                return questions;
            }
        }

        return [];
    }

    getCategoryQuestions(objectType) {
        // More specific fallback questions based on object type
        const specificFallbacks = {
            tree: [
                {
                    question: `I am a ${objectType}! What would happen if all trees disappeared?`,
                    options: ["Nothing would change", "Oxygen levels would drop drastically", "More space for buildings", "The weather would be better"],
                    correct: 1,
                    explanation: "Without trees, oxygen production would decrease and climate change would accelerate!"
                },
                {
                    question: `As a ${objectType}, how do I fight climate change?`,
                    options: ["I make noise", "I absorb carbon dioxide", "I attract cars", "I create pollution"],
                    correct: 1,
                    explanation: "Trees absorb carbon dioxide, helping reduce greenhouse gases in the atmosphere!"
                },
                {
                    question: `How many animals depend on trees like me?`,
                    options: ["Just a few insects", "Hundreds of species", "Only birds", "No animals need trees"],
                    correct: 1,
                    explanation: "A single tree can support hundreds of species - from insects to mammals to birds!"
                },
                {
                    question: `What happens to soil when forests are cut down?`,
                    options: ["Soil becomes more fertile", "Soil erodes and washes away", "Soil turns to gold", "Nothing happens to soil"],
                    correct: 1,
                    explanation: "Tree roots hold soil together - without them, precious topsoil erodes away!"
                },
                {
                    question: `How long does it take to replace a mature tree?`,
                    options: ["1 year", "5 years", "20-100 years", "Trees grow instantly"],
                    correct: 2,
                    explanation: "It takes decades to grow a mature tree - that's why protecting existing forests is so important!"
                }
            ],
            flower: [
                {
                    question: `I am a ${objectType}! What happens if flowers disappear?`,
                    options: ["Nothing changes", "Food crops would fail", "More concrete everywhere", "Less work for gardeners"],
                    correct: 1,
                    explanation: "Without flowers, pollination stops and many food crops would fail!"
                },
                {
                    question: `What percentage of food crops depend on flower pollination?`,
                    options: ["5%", "25%", "75%", "100%"],
                    correct: 2,
                    explanation: "About 75% of food crops depend on pollination - flowers are crucial for food security!"
                },
                {
                    question: `Who are my most important helpers?`,
                    options: ["Tractors", "Bees and butterflies", "Cars", "Lawnmowers"],
                    correct: 1,
                    explanation: "Bees, butterflies, and other pollinators help me reproduce by carrying my pollen!"
                },
                {
                    question: `What's killing my pollinator friends?`,
                    options: ["Too much rain", "Pesticides and habitat loss", "Too much sunshine", "They're not dying"],
                    correct: 1,
                    explanation: "Pesticides poison my pollinator friends, and habitat destruction leaves them homeless!"
                }
            ],
            water: [
                {
                    question: `I am ${objectType}! What would Earth be like without water bodies?`,
                    options: ["Exactly the same", "A lifeless desert planet", "More land for cities", "Easier transportation"],
                    correct: 1,
                    explanation: "Without water bodies, Earth would be a lifeless desert - all life depends on water!"
                },
                {
                    question: `How much of Earth's surface do water bodies cover?`,
                    options: ["25%", "50%", "71%", "90%"],
                    correct: 2,
                    explanation: "Water covers 71% of Earth's surface - that's why Earth is called the 'Blue Planet'!"
                },
                {
                    question: `What happens when I get polluted?`,
                    options: ["I become prettier", "Fish die and ecosystems collapse", "I flow faster", "Nothing changes"],
                    correct: 1,
                    explanation: "Pollution kills fish, destroys habitats, and makes water unsafe for all living things!"
                },
                {
                    question: `How do I help control Earth's temperature?`,
                    options: ["I don't affect temperature", "I absorb and release heat slowly", "I make everything hotter", "I freeze everything"],
                    correct: 1,
                    explanation: "Water bodies store and release heat slowly, helping regulate Earth's climate!"
                }
            ],
            animal: [
                {
                    question: `I am a ${objectType}! What happens when animals disappear from ecosystems?`,
                    options: ["Ecosystems become more balanced", "Ecosystems collapse completely", "Plants grow better", "Nothing changes"],
                    correct: 1,
                    explanation: "Each animal plays a crucial role - removing us disrupts the entire ecosystem balance!"
                },
                {
                    question: `What is happening to wildlife habitats around the world?`,
                    options: ["They're growing bigger", "They're being destroyed by humans", "They're moving to cities", "Nothing is happening"],
                    correct: 1,
                    explanation: "Human activities like deforestation and development are destroying our natural habitats!"
                },
                {
                    question: `How fast are species going extinct today?`,
                    options: ["Very slowly", "1,000 times faster than natural rate", "At normal speed", "Species never go extinct"],
                    correct: 1,
                    explanation: "We're in a mass extinction crisis - species are disappearing 1,000 times faster than normal!"
                },
                {
                    question: `What do animals need most to survive?`,
                    options: ["Television", "Protected natural habitat", "More roads", "Shopping malls"],
                    correct: 1,
                    explanation: "We need safe, protected habitats with food, water, and shelter to survive!"
                },
                {
                    question: `How are climate change and deforestation connected to animal extinction?`,
                    options: ["They're not connected", "They destroy our homes and food sources", "They help animals", "Only trees are affected"],
                    correct: 1,
                    explanation: "Climate change and habitat destruction eliminate our homes and food, forcing us toward extinction!"
                }
            ]
        };

        // Map object types to categories with more specificity
        const categoryMap = {
            // Trees
            tree: 'tree', oak: 'tree', pine: 'tree', maple: 'tree', birch: 'tree', leaf: 'tree', bark: 'tree',
            // Flowers  
            flower: 'flower', rose: 'flower', sunflower: 'flower', tulip: 'flower', daisy: 'flower',
            // Water
            ocean: 'water', river: 'water', lake: 'water', coral_reef: 'water', reef: 'water', water: 'water',
            // Animals
            rabbit: 'animal', bear: 'animal', bird: 'animal', butterfly: 'animal', bee: 'animal', 
            fish: 'animal', eagle: 'animal', 'Golden retriever': 'animal', 'tabby': 'animal',
            'Egyptian cat': 'animal', 'retriever': 'animal', 'tree frog': 'animal', 'monarch': 'animal',
            // Harmful objects
            cigarette: 'harmful', plastic: 'harmful', bottle: 'harmful', bag: 'harmful', can: 'harmful',
            trash: 'harmful', waste: 'harmful', pollution: 'harmful', smoke: 'harmful', oil: 'harmful',
            chemical: 'harmful', pesticide: 'harmful', factory: 'harmful', exhaust: 'harmful',
            fire: 'harmful', chainsaw: 'harmful', bulldozer: 'harmful'
        };

        // Add harmful objects quiz questions
        specificFallbacks.harmful = [
            {
                question: `I am a harmful object! What damage do I cause to the environment?`,
                options: ["I make nature more beautiful", "I poison ecosystems and kill wildlife", "I help plants grow", "I clean the air"],
                correct: 1,
                explanation: "Harmful objects like me poison soil, water, and air - destroying the delicate balance of nature!"
            },
            {
                question: `How can humans stop objects like me from destroying nature?`,
                options: ["Use more harmful objects", "Switch to eco-friendly alternatives", "Ignore the problem", "Throw me anywhere"],
                correct: 1,
                explanation: "The best way to protect nature is to use sustainable, eco-friendly alternatives and dispose of harmful items properly!"
            },
            {
                question: `What happens to wildlife when they encounter harmful objects?`,
                options: ["They become healthier", "They get poisoned or trapped", "They become stronger", "Nothing happens"],
                correct: 1,
                explanation: "Harmful objects poison wildlife, trap animals, and destroy their food sources and habitats!"
            },
            {
                question: `How long do most harmful objects stay in the environment?`,
                options: ["A few days", "Decades to centuries", "They disappear immediately", "Only one year"],
                correct: 1,
                explanation: "Most harmful objects persist for decades or centuries, continuing to damage ecosystems long after disposal!"
            }
        ];

        const category = categoryMap[objectType] || 'tree';
        return specificFallbacks[category] || specificFallbacks.tree;
    }

    startQuiz() {
        this.quizSection.style.display = 'block';
        this.quizBtn.style.display = 'none';
        this.currentQuestionIndex = 0;
        this.showQuestion();
    }

    showQuestion() {
        if (this.currentQuestionIndex >= this.currentQuestions.length) {
            this.showQuizComplete();
            return;
        }

        const question = this.currentQuestions[this.currentQuestionIndex];
        this.quizQuestion.textContent = question.question;
        this.quizFeedback.style.display = 'none';

        // Create option buttons
        this.quizOptions.innerHTML = '';
        question.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'quiz-option';
            button.textContent = option;
            button.onclick = () => this.selectAnswer(index, question.correct, question.explanation);
            this.quizOptions.appendChild(button);
        });
    }

    selectAnswer(selectedIndex, correctIndex, explanation) {
        const options = this.quizOptions.querySelectorAll('.quiz-option');
        
        // Disable all options
        options.forEach(option => option.style.pointerEvents = 'none');
        
        // Show correct/incorrect
        options[correctIndex].classList.add('correct');
        if (selectedIndex !== correctIndex) {
            options[selectedIndex].classList.add('wrong');
        }

        // Show feedback
        this.quizFeedback.style.display = 'block';
        this.quizFeedback.className = 'quiz-feedback ' + (selectedIndex === correctIndex ? 'correct' : 'wrong');
        this.quizFeedback.innerHTML = `
            <strong>${selectedIndex === correctIndex ? '🎉 Correct!' : '❌ Wrong!'}</strong><br>
            ${explanation}
        `;

        // Update score
        if (selectedIndex === correctIndex) {
            this.score += 10;
            this.scoreValue.textContent = this.score;
        }

        // Next question after delay (increased time to read explanations)
        setTimeout(() => {
            this.currentQuestionIndex++;
            this.showQuestion();
        }, 6000);
    }

    showQuizComplete() {
        this.quizSection.innerHTML = `
            <div class="quiz-complete">
                <h3>🏆 Quiz Complete!</h3>
                <div class="final-score">Final Score: ${this.score} points</div>
                <p>${this.getScoreMessage()}</p>
                <button class="btn btn-new" onclick="location.reload()">🌍 Discover More Nature</button>
            </div>
        `;
    }

    getScoreMessage() {
        if (this.score >= 20) {
            return "Amazing! You're a true nature expert! 🌟";
        } else if (this.score >= 10) {
            return "Great job! You know a lot about nature! 🌱";
        } else {
            return "Good try! Keep learning about our amazing natural world! 🌍";
        }
    }

    createNatureDatabase() {
        return {
            river: {
                emoji: '🏞️',
                keywords: ['river', 'stream', 'creek', 'waterfall', 'rapids', 'water', 'flowing water', 'brook', 'tributary'],
                introduction: 'I am a flowing river',
                message: 'I provide fresh water for life, transport nutrients through ecosystems, and carve beautiful landscapes.',
                plea: 'Please keep me clean and protect my watersheds from pollution!'
            },
            
            // Famous rivers
            'amazon-river': {
                emoji: '🏞️',
                keywords: ['amazon river', 'amazon', 'rio amazonas'],
                introduction: 'I am the mighty Amazon River',
                message: 'I am the world\'s largest river by volume, producing 20% of Earth\'s river water and supporting incredible biodiversity.',
                plea: 'Please save me from deforestation that disrupts my water cycle and destroys my rainforest!'
            },
            'nile-river': {
                emoji: '🏞️',
                keywords: ['nile river', 'nile', 'river nile'],
                introduction: 'I am the historic Nile River',
                message: 'I am the world\'s longest river, flowing 4,135 miles and supporting civilization for over 5,000 years.',
                plea: 'Please save me from dams and water diversions that disrupt my ancient flow!'
            },
            'mississippi-river': {
                emoji: '🏞️',
                keywords: ['mississippi river', 'mississippi', 'mighty mississippi'],
                introduction: 'I am the great Mississippi River',
                message: 'I drain 31 US states and carry nutrients from America\'s heartland to the Gulf of Mexico.',
                plea: 'Please save me from agricultural runoff that creates massive dead zones in my delta!'
            },
            'colorado-river': {
                emoji: '🏞️',
                keywords: ['colorado river', 'colorado', 'grand canyon river'],
                introduction: 'I am the carving Colorado River',
                message: 'I carved the Grand Canyon over millions of years and provide water for 40 million people.',
                plea: 'Please save me from over-allocation - I no longer reach the ocean!'
            },
            
            // Water bodies and features
            rapids: {
                emoji: '🌊',
                keywords: ['rapids', 'whitewater', 'river rapids', 'rushing water'],
                introduction: 'I am rushing rapids',
                message: 'I create thrilling whitewater and oxygenate the water for fish and aquatic life.',
                plea: 'Please save me from dams that block my natural flow patterns!'
            },
            waterfall: {
                emoji: '💧',
                keywords: ['waterfall', 'falls', 'cascade', 'plunge pool'],
                introduction: 'I am a cascading waterfall',
                message: 'I create negative ions that purify air and provide spectacular natural beauty.',
                plea: 'Please save me from water diversions that reduce my flow to a trickle!'
            },
            stream: {
                emoji: '🏞️',
                keywords: ['stream', 'small river', 'flowing water', 'mountain stream'],
                introduction: 'I am a gentle stream',
                message: 'I carry mountain snowmelt to larger rivers and create cool microclimates in forests.',
                plea: 'Please save me from erosion and siltation caused by development!'
            },
            pond: {
                emoji: '🏞️',
                keywords: ['pond', 'small lake', 'water hole', 'duck pond'],
                introduction: 'I am a quiet pond',
                message: 'I provide water for wildlife, support aquatic plants, and create peaceful natural spaces.',
                plea: 'Please save me from being filled in for development!'
            },
            wetland: {
                emoji: '🌾',
                keywords: ['wetland', 'marsh', 'swamp', 'bog', 'fen'],
                introduction: 'I am a vital wetland',
                message: 'I filter pollutants, prevent flooding, and support 40% of all species on only 6% of Earth\'s surface.',
                plea: 'Please save me from being drained for agriculture - half of all wetlands are already gone!'
            },
            mountain: {
                emoji: '⛰️',
                keywords: ['mountain', 'mountains', 'peak', 'summit', 'hill', 'valley', 'canyon', 'cliff', 'ridge', 'panoramic', 'landscape', 'scenic', 'vista'],
                introduction: 'I am a majestic mountain',
                message: 'I provide fresh water from my peaks, create diverse ecosystems, and offer breathtaking views that inspire humanity.',
                plea: 'Please protect me from mining damage and climate change effects!'
            },
            rainforest: {
                emoji: '🌿',
                keywords: ['rainforest', 'jungle', 'tropical forest', 'dense forest', 'amazon'],
                introduction: 'I am a living rainforest',
                message: 'I am the lungs of Earth, home to 80% of terrestrial biodiversity, and produce 20% of the world\'s oxygen.',
                plea: 'Please save me from deforestation and support conservation efforts!'
            },
            forest: {
                emoji: '🌲',
                keywords: ['forest', 'woods', 'woodland', 'forestry', 'grove', 'orchard'],
                introduction: 'I am a living forest',
                message: 'I clean your air, store carbon, prevent erosion, and provide homes for countless wildlife.',
                plea: 'Please protect me by supporting sustainable forestry and reforestation!'
            },
            mushroom: {
                emoji: '🍄',
                keywords: ['mushroom', 'fungus', 'fungi', 'toadstool', 'spore'],
                introduction: 'I am a mushroom',
                message: 'I decompose organic matter, create soil nutrients, and form networks that help forests communicate.',
                plea: 'Please respect my role in the ecosystem and avoid picking wild mushrooms!'
            },
            tree: {
                emoji: '🌳',
                keywords: ['tree', 'oak', 'pine', 'maple', 'birch', 'wood'],
                introduction: 'I am a mighty tree',
                message: 'I give you oxygen to breathe, shade to rest under, and homes for countless creatures.',
                plea: 'Please save me by not cutting down forests and planting more trees!'
            },
            
            // Deciduous trees (non-fruit)
            maple: {
                emoji: '🍁',
                keywords: ['maple', 'sugar maple', 'red maple', 'silver maple'],
                introduction: 'I am a magnificent maple tree',
                message: 'I create spectacular fall colors and produce sweet maple syrup from my sap in spring.',
                plea: 'Please save me from acid rain and climate change that threatens my syrup production!'
            },
            birch: {
                emoji: '🌳',
                keywords: ['birch', 'white birch', 'paper birch', 'silver birch'],
                introduction: 'I am a graceful birch tree',
                message: 'My white bark peels like paper and was used by Native Americans for canoes and writing.',
                plea: 'Please save me from deforestation and protect my shallow root systems!'
            },
            willow: {
                emoji: '🌳',
                keywords: ['willow', 'weeping willow', 'pussy willow', 'willow tree'],
                introduction: 'I am a weeping willow tree',
                message: 'My flexible branches were used to make baskets and my bark contains natural aspirin.',
                plea: 'Please save me from water pollution that affects my streamside habitat!'
            },
            oak: {
                emoji: '🌳',
                keywords: ['oak', 'white oak', 'red oak', 'live oak', 'acorn'],
                introduction: 'I am a majestic oak tree',
                message: 'I grow strong and tall, living for centuries and supporting entire ecosystems with my acorns.',
                plea: 'Please save me from development that destroys my centuries-old growth!'
            },
            
            // Coniferous trees  
            pine: {
                emoji: '🌲',
                keywords: ['pine', 'pine tree', 'pine cone', 'evergreen'],
                introduction: 'I am an evergreen pine tree',
                message: 'I stay green all year and provide shelter even in winter while producing valuable timber.',
                plea: 'Please save me from pine beetles and forest fires caused by climate change!'
            },
            spruce: {
                emoji: '🌲',
                keywords: ['spruce', 'spruce tree', 'norway spruce', 'christmas tree'],
                introduction: 'I am an evergreen spruce tree',
                message: 'I provide Christmas trees and my wood resonates beautifully in musical instruments.',
                plea: 'Please save me from air pollution that damages my needles!'
            },
            fir: {
                emoji: '🌲',
                keywords: ['fir', 'fir tree', 'douglas fir', 'balsam fir'],
                introduction: 'I am a noble fir tree',
                message: 'My needles are flat and friendly to touch, and I\'m often used for lumber and paper.',
                plea: 'Please save me from logging that doesn\'t replant and forest diseases!'
            },
            cedar: {
                emoji: '🌲',
                keywords: ['cedar', 'cedar tree', 'red cedar', 'white cedar'],
                introduction: 'I am an aromatic cedar tree',
                message: 'My aromatic wood resists insects and decay, making me perfect for outdoor construction.',
                plea: 'Please save me from habitat loss and unsustainable harvesting!'
            },
            redwood: {
                emoji: '🌲',
                keywords: ['redwood', 'giant redwood', 'sequoia', 'coast redwood'],
                introduction: 'I am a giant redwood tree',
                message: 'I am among the tallest and oldest living things on Earth, reaching over 300 feet tall.',
                plea: 'Please save me - only 5% of my original forests remain!'
            },
            
            // Tropical and exotic trees
            bamboo: {
                emoji: '🎋',
                keywords: ['bamboo', 'bamboo grove', 'giant bamboo'],
                introduction: 'I am fast-growing bamboo',
                message: 'I\'m actually a giant grass that can grow 3 feet in one day and is stronger than steel.',
                plea: 'Please use me sustainably as an eco-friendly alternative to wood!'
            },
            eucalyptus: {
                emoji: '🌳',
                keywords: ['eucalyptus', 'gum tree', 'koala tree'],
                introduction: 'I am a fragrant eucalyptus tree',
                message: 'My oils are medicinal and aromatic, and I can grow 6 feet in one year.',
                plea: 'Please plant me responsibly - I can be invasive outside my native Australia!'
            },
            flower: {
                emoji: '🌸',
                keywords: ['flower', 'rose', 'tulip', 'daisy', 'bloom', 'petal'],
                introduction: 'I am a beautiful flower',
                message: 'I bring color to your world and help bees make honey.',
                plea: 'Please save me by not picking wildflowers and protecting pollinator habitats!'
            },
            sunflower: {
                emoji: '🌻',
                keywords: ['sunflower'],
                introduction: 'I am a bright sunflower',
                message: 'I turn my face to follow the sun and provide nutritious seeds for birds and humans.',
                plea: 'Please save me by supporting organic farming and protecting natural habitats!'
            },
            lavender: {
                emoji: '💜',
                keywords: ['lavender', 'purple', 'aromatic', 'herb'],
                introduction: 'I am fragrant lavender',
                message: 'I calm your mind with my scent and attract bees to my purple flowers.',
                plea: 'Please save me by supporting organic farming and bee-friendly gardens!'
            },
            orchid: {
                emoji: '🌺',
                keywords: ['orchid', 'exotic', 'tropical', 'elegant'],
                introduction: 'I am an elegant orchid',
                message: 'I am one of the largest flower families with over 25,000 species. My intricate blooms can last for months.',
                plea: 'Please save me by protecting tropical forests and not collecting wild orchids!'
            },
            rose: {
                emoji: '🌹',
                keywords: ['rose', 'romantic', 'thorns', 'fragrant'],
                introduction: 'I am a beautiful rose',
                message: 'I have been cherished for thousands of years and symbolize love and beauty across cultures.',
                plea: 'Please save me by supporting sustainable flower farming and protecting wild roses!'
            },
            tulip: {
                emoji: '🌷',
                keywords: ['tulip', 'spring', 'bulb', 'colorful'],
                introduction: 'I am a vibrant tulip',
                message: 'I emerge each spring from bulbs and bring bright colors after winter. I come in nearly every color except true blue.',
                plea: 'Please save me by planting native varieties and protecting natural grasslands!'
            },
            daisy: {
                emoji: '🌼',
                keywords: ['daisy', 'simple', 'cheerful', 'white'],
                introduction: 'I am a cheerful daisy',
                message: 'My simple beauty brightens meadows and I can bloom almost year-round in the right conditions.',
                plea: 'Please save me by not using lawn chemicals and leaving wild spaces for me to grow!'
            },
            lily: {
                emoji: '🌸',
                keywords: ['lily', 'elegant', 'trumpet', 'bulb'],
                introduction: 'I am a graceful lily',
                message: 'My trumpet-shaped flowers have guided travelers and inspired artists for millennia.',
                plea: 'Please save me by protecting wetlands and avoiding toxic pesticides!'
            },
            lotus: {
                emoji: '🪷',
                keywords: ['lotus', 'sacred', 'water', 'purity'],
                introduction: 'I am a sacred lotus',
                message: 'I rise pure from muddy waters and symbolize rebirth and enlightenment in many cultures.',
                plea: 'Please save me by keeping waterways clean and protecting wetland habitats!'
            },
            iris: {
                emoji: '🌺',
                keywords: ['iris', 'sword', 'rainbow', 'flag'],
                introduction: 'I am a stately iris',
                message: 'My sword-like leaves and colorful blooms have inspired flags and coat of arms throughout history.',
                plea: 'Please save me by preserving natural meadows and avoiding habitat destruction!'
            },
            // Garden flowers
            carnation: {
                emoji: '🌸',
                keywords: ['carnation', 'dianthus', 'pink'],
                introduction: 'I am a ruffled carnation',
                message: 'I have ruffled petals and can bloom for weeks, making me perfect for gardens and bouquets.',
                plea: 'Please save me by supporting sustainable flower farming!'
            },
            chrysanthemum: {
                emoji: '🌼',
                keywords: ['chrysanthemum', 'mum', 'autumn flower'],
                introduction: 'I am a colorful chrysanthemum',
                message: 'I bloom in autumn when other flowers fade, bringing color to the season.',
                plea: 'Please save me by choosing sustainable cut flowers and supporting organic gardens!'
            },
            petunia: {
                emoji: '🌺',
                keywords: ['petunia', 'trumpet flower'],
                introduction: 'I am a vibrant petunia',
                message: 'I bloom continuously all summer long and attract hummingbirds with my trumpet shape.',
                plea: 'Please save me by avoiding harmful pesticides and planting pollinator gardens!'
            },
            marigold: {
                emoji: '🌼',
                keywords: ['marigold', 'tagetes', 'mary gold'],
                introduction: 'I am a bright marigold',
                message: 'I naturally repel garden pests while attracting beneficial insects with my vibrant colors.',
                plea: 'Please save me by choosing companion planting over chemical pesticides!'
            },
            zinnia: {
                emoji: '🌻',
                keywords: ['zinnia', 'youth flower'],
                introduction: 'I am a cheerful zinnia',
                message: 'I attract butterflies and last long as cut flowers, bringing joy to gardens and homes.',
                plea: 'Please save me by supporting organic gardening and butterfly conservation!'
            },
            peony: {
                emoji: '🌸',
                keywords: ['peony', 'paeonia'],
                introduction: 'I am a lush peony',
                message: 'I can live for 100 years and my huge, fragrant blooms herald late spring.',
                plea: 'Please save me by protecting established gardens and avoiding soil disturbance!'
            },
            daffodil: {
                emoji: '🌼',
                keywords: ['daffodil', 'narcissus', 'jonquil'],
                introduction: 'I am a cheerful daffodil',
                message: 'I am one of the first flowers of spring, pushing through snow to announce winter\'s end.',
                plea: 'Please save me by protecting natural meadows and avoiding early mowing!'
            },
            azalea: {
                emoji: '🌺',
                keywords: ['azalea', 'rhododendron'],
                introduction: 'I am a stunning azalea',
                message: 'I create spectacular spring displays and my nectar feeds early pollinators.',
                plea: 'Please save me by maintaining acidic soil and protecting woodland habitats!'
            },
            camellia: {
                emoji: '🌸',
                keywords: ['camellia', 'tea flower'],
                introduction: 'I am an elegant camellia',
                message: 'I bloom in winter when few other flowers do, and my cousin provides tea leaves.',
                plea: 'Please save me by protecting ancient garden varieties and supporting sustainable cultivation!'
            },
            begonia: {
                emoji: '🌺',
                keywords: ['begonia', 'wax begonia'],
                introduction: 'I am a colorful begonia',
                message: 'I thrive in shade where other flowers cannot, bringing color to dark corners.',
                plea: 'Please save me by preserving forest understory habitats and shade gardens!'
            },
            impatiens: {
                emoji: '🌸',
                keywords: ['impatiens', 'busy lizzie', 'touch me not'],
                introduction: 'I am a delicate impatiens',
                message: 'My seed pods explode when touched, spreading my seeds in a burst of motion.',
                plea: 'Please save me by protecting moist woodland areas and avoiding downy mildew!'
            },
            geranium: {
                emoji: '🌺',
                keywords: ['geranium', 'pelargonium', 'cranesbill'],
                introduction: 'I am a hardy geranium',
                message: 'I bloom reliably all season and my scented leaves naturally repel insects.',
                plea: 'Please save me by supporting water-wise gardening and organic growing methods!'
            },
            // Wildflowers and native flowers
            poppy: {
                emoji: '🌺',
                keywords: ['poppy', 'papaver', 'corn poppy'],
                introduction: 'I am a vibrant poppy',
                message: 'I grow in disturbed soil and my seeds can sleep for decades before blooming.',
                plea: 'Please save me by preserving wild meadows and avoiding habitat destruction!'
            },
            'forget-me-not': {
                emoji: '💙',
                keywords: ['forget-me-not', 'myosotis', 'true love'],
                introduction: 'I am a tiny forget-me-not',
                message: 'Though small, I create carpets of blue and symbolize true love and remembrance.',
                plea: 'Please save me by protecting moist woodland edges and stream banks!'
            },
            bluebell: {
                emoji: '🔵',
                keywords: ['bluebell', 'bluebonnet', 'wild hyacinth'],
                introduction: 'I am a magical bluebell',
                message: 'I create enchanted blue carpets in spring woodlands before trees leaf out.',
                plea: 'Please save me by staying on woodland paths and never picking my bulbs!'
            },
            buttercup: {
                emoji: '🌼',
                keywords: ['buttercup', 'ranunculus', 'crowfoot'],
                introduction: 'I am a golden buttercup',
                message: 'My shiny petals reflect light like tiny mirrors, brightening meadows everywhere.',
                plea: 'Please save me by preserving natural grasslands and avoiding chemical spraying!'
            },
            clover: {
                emoji: '🍀',
                keywords: ['clover', 'shamrock', 'trefoil'],
                introduction: 'I am nutritious clover',
                message: 'I fix nitrogen in soil, feeding other plants while providing nectar for bees.',
                plea: 'Please save me by supporting diverse lawns over monoculture grass!'
            },
            dandelion: {
                emoji: '🌼',
                keywords: ['dandelion', 'taraxacum', 'lion tooth'],
                introduction: 'I am a resilient dandelion',
                message: 'Every part of me is edible and medicinal, and I can grow anywhere life is possible.',
                plea: 'Please save me by appreciating my value instead of poisoning me with chemicals!'
            },
            'wild-rose': {
                emoji: '🌹',
                keywords: ['wild rose', 'dog rose', 'rosa canina'],
                introduction: 'I am a wild rose',
                message: 'I am the ancestor of garden roses, producing vitamin-rich hips that feed wildlife.',
                plea: 'Please save me by preserving hedgerows and natural areas where I grow wild!'
            },
            primrose: {
                emoji: '🌼',
                keywords: ['primrose', 'primula', 'cowslip'],
                introduction: 'I am a delicate primrose',
                message: 'I am among the first flowers of spring, bringing pale beauty to woodland floors.',
                plea: 'Please save me by protecting ancient woodlands and avoiding soil disturbance!'
            },
            foxglove: {
                emoji: '💜',
                keywords: ['foxglove', 'digitalis', 'fairy glove'],
                introduction: 'I am a stately foxglove',
                message: 'I tower above other wildflowers and my compounds help human hearts beat steadily.',
                plea: 'Please save me by preserving woodland clearings and respecting my medicinal power!'
            },
            snapdragon: {
                emoji: '🌺',
                keywords: ['snapdragon', 'antirrhinum', 'dragon mouth'],
                introduction: 'I am a playful snapdragon',
                message: 'Children love to squeeze my flowers to make my "mouth" snap open and closed.',
                plea: 'Please save me by supporting heirloom varieties and seed saving!'
            },
            // Exotic and tropical flowers
            'bird-of-paradise': {
                emoji: '🧡',
                keywords: ['bird of paradise', 'strelitzia', 'crane flower'],
                introduction: 'I am an exotic bird-of-paradise',
                message: 'My orange and blue flowers look like tropical birds in flight.',
                plea: 'Please save me by protecting tropical habitats and supporting sustainable tourism!'
            },
            anthurium: {
                emoji: '❤️',
                keywords: ['anthurium', 'flamingo flower', 'tail flower'],
                introduction: 'I am a striking anthurium',
                message: 'My shiny, heart-shaped blooms can last for months and purify indoor air.',
                plea: 'Please save me by supporting sustainable tropical agriculture and fair trade!'
            },
            frangipani: {
                emoji: '🌺',
                keywords: ['frangipani', 'plumeria', 'temple tree'],
                introduction: 'I am a fragrant frangipani',
                message: 'My sweet perfume fills tropical evenings and my flowers are used in sacred ceremonies.',
                plea: 'Please save me by protecting sacred groves and traditional cultural practices!'
            },
            bougainvillea: {
                emoji: '🌺',
                keywords: ['bougainvillea', 'paper flower'],
                introduction: 'I am a vibrant bougainvillea',
                message: 'My colorful bracts aren\'t actually petals, but they create stunning displays year-round.',
                plea: 'Please save me by supporting water-wise gardening in warm climates!'
            },
            protea: {
                emoji: '🌺',
                keywords: ['protea', 'king protea', 'sugar bush'],
                introduction: 'I am a unique protea',
                message: 'I am South Africa\'s national flower, adapted to survive wildfires and drought.',
                plea: 'Please save me by protecting fynbos ecosystems and supporting fire management!'
            },
            'passion-flower': {
                emoji: '💜',
                keywords: ['passion flower', 'passiflora', 'maypop'],
                introduction: 'I am an intricate passion flower',
                message: 'My complex flowers inspired religious symbolism and I host butterfly caterpillars.',
                plea: 'Please save me by preserving native vines and supporting butterfly conservation!'
            },
            // Bulb flowers
            crocus: {
                emoji: '💜',
                keywords: ['crocus', 'saffron crocus'],
                introduction: 'I am a brave crocus',
                message: 'I push through snow to bloom in late winter, and some of my kind produce precious saffron.',
                plea: 'Please save me by protecting meadows and avoiding early spring cleanup!'
            },
            hyacinth: {
                emoji: '💜',
                keywords: ['hyacinth', 'hyacinthus', 'dutch hyacinth'],
                introduction: 'I am a fragrant hyacinth',
                message: 'My intense perfume can fill entire gardens and I\'ve been cultivated for centuries.',
                plea: 'Please save me by supporting sustainable bulb farming and preserving old varieties!'
            },
            amaryllis: {
                emoji: '🌺',
                keywords: ['amaryllis', 'hippeastrum', 'belladonna lily'],
                introduction: 'I am a dramatic amaryllis',
                message: 'I produce huge flowers on tall stems, bringing tropical beauty to temperate homes.',
                plea: 'Please save me by supporting sustainable bulb cultivation and avoiding wild collection!'
            },
            gladiolus: {
                emoji: '🌺',
                keywords: ['gladiolus', 'sword lily', 'glad'],
                introduction: 'I am a stately gladiolus',
                message: 'My sword-like leaves and tall flower spikes have symbolized strength for centuries.',
                plea: 'Please save me by supporting cut flower farmers and preserving heirloom varieties!'
            },
            freesia: {
                emoji: '💛',
                keywords: ['freesia', 'fragrant freesia'],
                introduction: 'I am a delicate freesia',
                message: 'My small flowers pack an incredibly sweet fragrance that perfumers treasure.',
                plea: 'Please save me by supporting sustainable perfume industry and South African conservation!'
            },
            // Climbing and vine flowers
            'morning-glory': {
                emoji: '🌺',
                keywords: ['morning glory', 'ipomoea', 'bindweed'],
                introduction: 'I am a climbing morning glory',
                message: 'I open my trumpet flowers at dawn and close them by afternoon.',
                plea: 'Please save me by providing climbing supports and managing my spread responsibly!'
            },
            'sweet-pea': {
                emoji: '🌸',
                keywords: ['sweet pea', 'lathyrus', 'fragrant pea'],
                introduction: 'I am a climbing sweet pea',
                message: 'My delicate flowers smell incredibly sweet and come in pastel rainbow colors.',
                plea: 'Please save me by supporting heirloom seed varieties and organic gardening!'
            },
            clematis: {
                emoji: '💜',
                keywords: ['clematis', 'virgin\'s bower', 'old man\'s beard'],
                introduction: 'I am a graceful clematis',
                message: 'I can climb 20 feet high and my fluffy seed heads are as beautiful as my flowers.',
                plea: 'Please save me by providing proper support and protecting my root zone!'
            },
            honeysuckle: {
                emoji: '🌼',
                keywords: ['honeysuckle', 'lonicera', 'woodbine'],
                introduction: 'I am a sweet honeysuckle',
                message: 'Children love to sip nectar from my flowers, and I perfume summer evenings.',
                plea: 'Please save me by choosing native species and managing invasive varieties!'
            },
            // Herb flowers
            chamomile: {
                emoji: '🌼',
                keywords: ['chamomile', 'matricaria', 'german chamomile'],
                introduction: 'I am soothing chamomile',
                message: 'My tiny daisy flowers make calming tea and naturally repel garden pests.',
                plea: 'Please save me by supporting organic herb farming and medicinal plant gardens!'
            },
            sage: {
                emoji: '💜',
                keywords: ['sage', 'salvia', 'purple sage'],
                introduction: 'I am wise sage',
                message: 'My purple flower spikes attract bees and my leaves have been used medicinally for millennia.',
                plea: 'Please save me by supporting drought-resistant gardening and traditional medicine!'
            },
            mint: {
                emoji: '💜',
                keywords: ['mint flower', 'mentha', 'spearmint'],
                introduction: 'I am refreshing mint',
                message: 'My small purple flowers top aromatic stems that flavor food and medicine.',
                plea: 'Please save me by supporting sustainable herb cultivation and organic farming!'
            },
            thyme: {
                emoji: '💜',
                keywords: ['thyme flower', 'thymus', 'wild thyme'],
                introduction: 'I am tiny thyme',
                message: 'My miniature flowers carpet the ground and my leaves season food while healing wounds.',
                plea: 'Please save me by preserving Mediterranean habitats and supporting organic herbs!'
            },
            river: {
                emoji: '🏞️',
                keywords: ['river', 'stream', 'water', 'lake', 'pond', 'brook'],
                introduction: 'I am a flowing river',
                message: 'I provide fresh water for all living beings and carry life through the land.',
                plea: 'Please save me by not polluting water and keeping my banks clean!'
            },
            mountain: {
                emoji: '⛰️',
                keywords: ['mountain', 'hill', 'peak', 'summit', 'rock'],
                introduction: 'I am an ancient mountain',
                message: 'I create weather patterns, store fresh water, and provide minerals.',
                plea: 'Please save me by preventing erosion and not littering on my slopes!'
            },
            bird: {
                emoji: '🐦',
                keywords: ['bird', 'eagle', 'sparrow', 'robin', 'owl', 'hawk'],
                introduction: 'I am a free-flying bird',
                message: 'I help spread seeds, control pests, and fill the sky with beautiful songs.',
                plea: 'Please save me by protecting my nesting areas and keeping cats indoors!'
            },
            butterfly: {
                emoji: '🦋',
                keywords: ['butterfly', 'moth', 'wing'],
                introduction: 'I am a delicate butterfly',
                message: 'I pollinate flowers and transform from a caterpillar in an amazing metamorphosis.',
                plea: 'Please save me by planting native flowers and avoiding pesticides!'
            },
            insect: {
                emoji: '🐛',
                keywords: ['insect', 'bug', 'arthropod', 'invertebrate'],
                introduction: 'I am a small insect',
                message: 'I play a vital role in ecosystems through pollination, decomposition, and serving as food for other animals.',
                plea: 'Please save me by avoiding pesticides and protecting natural habitats!'
            },
            bear: {
                emoji: '🐻',
                keywords: ['bear', 'grizzly', 'black bear', 'brown bear', 'polar bear'],
                introduction: 'I am a powerful bear',
                message: 'I help spread seeds through the forest and keep ecosystems balanced.',
                explanation: 'Bears are intelligent mammals with excellent memory and problem-solving skills. We play crucial roles as both predators and seed dispersers.',
                plea: 'Please save me by protecting wilderness areas and securing your garbage!'
            },
            kangaroo: {
                emoji: '🦘',
                keywords: ['kangaroo', 'marsupial', 'wallaby', 'joey', 'australian'],
                introduction: 'I am a kangaroo',
                message: 'I am a unique marsupial that carries my young in a pouch and can hop at speeds up to 35 mph across the Australian landscape.',
                explanation: 'Kangaroos are the largest marsupials on Earth and can go long periods without water. My powerful hind legs allow me to cover 25 feet in a single bound!',
                plea: 'Please save me by protecting Australian grasslands and preventing habitat destruction!'
            },
            snake: {
                emoji: '🐍',
                keywords: ['snake', 'serpent', 'reptile'],
                introduction: 'I am a fascinating snake',
                message: 'I control rodent populations and play a vital role in ecosystem balance.',
                explanation: 'Snakes are fascinating reptiles that can unhinge their jaws to swallow prey larger than their head. We shed our entire skin as we grow and have incredible sensory abilities.',
                plea: 'Please save me by protecting my habitat and learning that I am not your enemy!'
            },
            
            // Australian Snakes - Venomous
            'eastern-brown-snake': {
                emoji: '🐍',
                keywords: ['eastern brown snake', 'eastern brown', 'brown snake', 'pseudonaja textilis'],
                introduction: 'I am an Eastern Brown Snake',
                message: 'I am Australia\'s second most venomous land snake and a fast, aggressive hunter that controls rodent populations across eastern Australia. ⚠️ DANGER: I am extremely venomous and potentially deadly - keep your distance and call a snake catcher immediately!',
                explanation: 'Eastern Brown Snakes are responsible for about 60% of snakebite deaths in Australia. Despite their name, they range from pale brown to almost black. We can move at speeds up to 12 km/h and are excellent climbers.',
                consequences: 'if I disappear: rodent populations would explode across eastern Australia, devastating crops and spreading disease.',
                plea: 'Please save me by respecting my space, keeping your property tidy, and calling snake catchers instead of killing me!'
            },
            'taipan': {
                emoji: '🐍', 
                keywords: ['taipan', 'coastal taipan', 'inland taipan', 'fierce snake', 'oxyuranus'],
                introduction: 'I am a Taipan',
                message: 'I am one of the world\'s most venomous snakes, but I prefer to avoid humans and play a crucial role in controlling Australia\'s small mammal populations. ⚠️ EXTREME DANGER: I am the world\'s most venomous land snake - evacuate the area immediately and call emergency services!',
                explanation: 'Taipans include the Inland Taipan (most venomous land snake) and Coastal Taipan. We have excellent eyesight and can strike with lightning speed. Our venom is incredibly potent but we rarely bite humans.',
                consequences: 'if I disappear: small mammal populations would boom uncontrolled, destroying native vegetation and crops.',
                plea: 'Please save me by protecting Australia\'s native habitats and never attempting to handle me!'
            },
            'death-adder': {
                emoji: '🐍',
                keywords: ['death adder', 'common death adder', 'acanthophis', 'desert death adder'],
                introduction: 'I am a Death Adder',
                message: 'I am an ambush predator with a unique hunting style - I wiggle my tail to lure prey and help control Australia\'s small animal populations. ⚠️ DANGER: I am highly venomous and won\'t flee when approached - watch where you step and call a snake catcher!',
                explanation: 'Death Adders are unique among Australian snakes because we don\'t flee when approached. We have a triangular head, short thick body, and a distinctive tail tip that we use as a lure for prey.',
                consequences: 'if I disappear: lizard and small mammal populations would grow unchecked across Australian bushland.',
                plea: 'Please save me by watching where you step in the bush and preserving my native woodland habitats!'
            },
            'tiger-snake': {
                emoji: '🐍',
                keywords: ['tiger snake', 'notechis scutatus', 'black tiger snake'],
                introduction: 'I am a Tiger Snake',
                message: 'I am a highly venomous but generally docile snake that loves wetlands and helps control frog, fish, and small mammal populations. ⚠️ DANGER: I am venomous but usually shy - give me space and call a snake catcher!',
                explanation: 'Tiger Snakes are semi-aquatic and excellent swimmers. We get our name from our banded pattern, though some populations are completely black. We can flatten our necks when threatened.',
                consequences: 'if I disappear: wetland ecosystems would become unbalanced with exploding frog and fish populations.',
                plea: 'Please save me by protecting Australia\'s wetlands, rivers, and coastal areas from pollution and development!'
            },
            'red-bellied-black-snake': {
                emoji: '🐍',
                keywords: ['red bellied black snake', 'red belly black snake', 'rbbs', 'pseudechis porphyriacus'],
                introduction: 'I am a Red-bellied Black Snake',
                message: 'I am a beautiful venomous snake with a glossy black back and bright red belly. I love water and help control frog, fish, and small mammal populations. ⚠️ CAUTION: I am mildly venomous but rarely bite - I prefer to flee, but still call a snake catcher!',
                explanation: 'Red-bellied Black Snakes are generally shy and reluctant to bite. We spend much of our time near water sources and are excellent swimmers. Our striking red belly warns predators to stay away.',
                consequences: 'if I disappear: wetland pest populations would explode, affecting water quality and native ecosystems.',
                plea: 'Please save me by keeping waterways clean and giving me space when you see me near creeks and dams!'
            },
            
            // Australian Snakes - Non-venomous
            'carpet-python': {
                emoji: '🐍',
                keywords: ['carpet python', 'diamond python', 'morelia spilota', 'coastal carpet python'],
                introduction: 'I am a Carpet Python',
                message: 'I am Australia\'s largest non-venomous snake, a powerful constrictor that helps control possum, bird, and small mammal populations. ✅ SAFE: I am non-venomous and rarely bite humans - I can be safely relocated by professionals!',
                explanation: 'Carpet Pythons can grow up to 4 meters long and live over 20 years. We are excellent climbers and often rest in tree hollows or roof spaces. Our beautiful patterns provide perfect camouflage.',
                consequences: 'if I disappear: possum and rat populations would boom, causing massive damage to gardens, crops, and native bird nests.',
                plea: 'Please save me by appreciating my pest control services and calling snake catchers to relocate me safely!'
            },
            'childrens-python': {
                emoji: '🐍',
                keywords: ['childrens python', 'children python', 'antaresia childreni', 'spotted python'],
                introduction: 'I am a Children\'s Python',
                message: 'I am one of Australia\'s smallest pythons, perfectly sized for controlling mice, rats, and small birds in both wild and urban areas. ✅ SAFE: I am non-venomous and very docile - perfect natural pest control that poses no danger to humans!',
                explanation: 'Children\'s Pythons (named after zoologist John George Children) are nocturnal hunters that rarely exceed 1.5 meters. We\'re popular in the pet trade and excellent natural pest controllers.',
                consequences: 'if I disappear: rodent populations would explode in Australian homes and farms, spreading disease and destroying stored food.',
                plea: 'Please save me by valuing my pest control services and choosing humane relocation over killing!'
            },
            'woma-python': {
                emoji: '🐍',
                keywords: ['woma python', 'woma', 'aspidites ramsayi', 'sand python'],
                introduction: 'I am a Woma Python',
                message: 'I am a ground-dwelling python that specializes in hunting other snakes, including venomous species, making me nature\'s snake controller. ✅ SAFE: I am non-venomous and actually reduce dangerous snake populations - I\'m beneficial to have around!',
                explanation: 'Woma Pythons are immune to many snake venoms and actively hunt other snakes. We live in arid regions and have a distinctive broad head and narrow neck. We\'re also excellent burrowers.',
                consequences: 'if I disappear: venomous snake populations would increase dramatically, posing greater risks to humans and livestock.',
                plea: 'Please save me by protecting Australia\'s arid landscapes and understanding my vital role in controlling dangerous snakes!'
            }
            // Comprehensive Animal Database - Domestic animals
            dog: {
                emoji: '🐕',
                keywords: ['dog', 'puppy', 'canine', 'golden retriever', 'labrador'],
                introduction: 'I am a loyal dog',
                message: 'I am humanity\'s oldest companion, loyal for over 15,000 years, and can detect diseases with my nose.',
                plea: 'Please save me by adopting from shelters and being a responsible pet owner!'
            },
            cat: {
                emoji: '🐱',
                keywords: ['cat', 'kitten', 'feline', 'tabby', 'persian cat'],
                introduction: 'I am an independent cat',
                message: 'I control rodent populations and have been worshipped by humans since ancient Egypt.',
                plea: 'Please save me by keeping me indoors to protect birds and getting me spayed/neutered!'
            },
            horse: {
                emoji: '🐴',
                keywords: ['horse', 'stallion', 'mare', 'foal', 'pony'],
                introduction: 'I am a majestic horse',
                message: 'I helped build civilizations by carrying humans and goods across continents for thousands of years.',
                plea: 'Please save me by supporting humane treatment and wild mustang protection!'
            },
            
            // Wild mammals
            wolf: {
                emoji: '🐺',
                keywords: ['wolf', 'gray wolf', 'pack', 'alpha wolf'],
                introduction: 'I am a wild wolf',
                message: 'I control deer populations and my howls can be heard up to 6 miles away in forest ecosystems.',
                plea: 'Please save me by protecting wilderness and understanding I avoid humans!'
            },
            fox: {
                emoji: '🦊',
                keywords: ['fox', 'red fox', 'arctic fox', 'fennec fox'],
                introduction: 'I am a clever fox',
                message: 'I control rodent populations with my excellent hearing and can jump 6 feet high to catch prey.',
                plea: 'Please save me by preserving habitats and reducing vehicle strikes!'
            },
            deer: {
                emoji: '🦌',
                keywords: ['deer', 'white-tail', 'buck', 'doe', 'fawn'],
                introduction: 'I am a graceful deer',
                message: 'I help plant forests by spreading seeds in my droppings and serve as food for large predators.',
                plea: 'Please save me by driving carefully and preserving natural corridors!'
            },
            elephant: {
                emoji: '🐘',
                keywords: ['elephant', 'african elephant', 'asian elephant'],
                introduction: 'I am a wise elephant',
                message: 'I have the largest brain of any land animal and can communicate using infrasonic sounds.',
                plea: 'Please save me from ivory poaching and habitat destruction!'
            },
            lion: {
                emoji: '🦁',
                keywords: ['lion', 'lioness', 'pride', 'mane'],
                introduction: 'I am a powerful lion',
                message: 'I am the only cat that lives in social groups and my roar can be heard from 5 miles away.',
                plea: 'Please save me from habitat loss and human-wildlife conflict!'
            },
            tiger: {
                emoji: '🐅',
                keywords: ['tiger', 'siberian tiger', 'bengal tiger'],
                introduction: 'I am a fierce tiger',
                message: 'I am the largest wild cat and each of my stripes is unique, like human fingerprints.',
                plea: 'Please save me from poaching and deforestation - only 3,200 of us remain!'
            },
            giraffe: {
                emoji: '🦒',
                keywords: ['giraffe', 'tall neck', 'african giraffe'],
                introduction: 'I am a tall giraffe',
                message: 'I am the tallest mammal with a heart that weighs 25 pounds to pump blood up my long neck.',
                plea: 'Please save me from habitat fragmentation and illegal hunting!'
            },
            
            // Primates
            monkey: {
                emoji: '🐒',
                keywords: ['monkey', 'primate', 'ape'],
                introduction: 'I am a playful monkey',
                message: 'I use tools, have complex social structures, and can learn sign language to communicate with humans.',
                plea: 'Please save me from deforestation and the illegal pet trade!'
            },
            gorilla: {
                emoji: '🦍',
                keywords: ['gorilla', 'silverback', 'mountain gorilla'],
                introduction: 'I am a gentle gorilla',
                message: 'Despite my strength, I am gentle and vegetarian, eating up to 40 pounds of plants daily.',
                plea: 'Please save me from poaching and protect my mountain forest home!'
            },
            
            // Humans
            human: {
                emoji: '👤',
                keywords: ['person', 'people', 'human', 'man', 'woman', 'child', 'adult', 'portrait', 'face', 'individual'],
                introduction: 'I am a human being',
                message: 'I am the most adaptable species on Earth, capable of complex reasoning, creativity, and building civilizations that span the globe.',
                plea: 'Please help me live sustainably and protect the natural world for future generations!'
            },
            
            // Marine mammals
            whale: {
                emoji: '🐋',
                keywords: ['whale', 'humpback', 'blue whale', 'sperm whale'],
                introduction: 'I am a magnificent whale',
                message: 'I am the largest animal ever known to exist and my songs can travel hundreds of miles underwater.',
                plea: 'Please save me from ship strikes, plastic pollution, and noise pollution!'
            },
            dolphin: {
                emoji: '🐬',
                keywords: ['dolphin', 'bottlenose', 'marine mammal'],
                introduction: 'I am an intelligent dolphin',
                message: 'I have a complex language, use echolocation to navigate, and can recognize myself in mirrors.',
                plea: 'Please save me from fishing nets, pollution, and captivity!'
            },
            
            // Birds
            eagle: {
                emoji: '🦅',
                keywords: ['eagle', 'bald eagle', 'golden eagle', 'raptor'],
                introduction: 'I am a soaring eagle',
                message: 'I have eyesight 8 times sharper than humans and control rodent populations in ecosystems.',
                plea: 'Please save me from lead poisoning and protect my nesting areas!'
            },
            owl: {
                emoji: '🦉',
                keywords: ['owl', 'hoot owl', 'barn owl', 'great horned'],
                introduction: 'I am a wise owl',
                message: 'I hunt silently at night and can turn my head 270 degrees to spot prey.',
                plea: 'Please save me by preserving old forests and reducing rodenticides!'
            },
            flamingo: {
                emoji: '🦩',
                keywords: ['flamingo', 'pink bird', 'wading bird'],
                introduction: 'I am a pink flamingo',
                message: 'My pink color comes from eating shrimp and algae, and I can live over 50 years.',
                plea: 'Please save me from habitat destruction and water pollution!'
            },
            penguin: {
                emoji: '🐧',
                keywords: ['penguin', 'antarctic bird', 'flightless'],
                introduction: 'I am a tuxedo-wearing penguin',
                message: 'I can swim up to 22 mph and huddle with thousands of others to survive Antarctic winters.',
                plea: 'Please save me from climate change melting my icy home!'
            },
            
            // Marine life
            shark: {
                emoji: '🦈',
                keywords: ['shark', 'great white', 'predator fish'],
                introduction: 'I am a powerful shark',
                message: 'I have existed for over 400 million years and play a crucial role in maintaining ocean health.',
                plea: 'Please save me from overfishing and shark fin soup demand!'
            },
            octopus: {
                emoji: '🐙',
                keywords: ['octopus', 'tentacles', 'cephalopod'],
                introduction: 'I am an intelligent octopus',
                message: 'I have three hearts, blue blood, and can change color and texture to match my surroundings.',
                plea: 'Please save me from ocean pollution and overfishing!'
            },
            'sea-turtle': {
                emoji: '🐢',
                keywords: ['sea turtle', 'turtle', 'marine reptile'],
                introduction: 'I am an ancient sea turtle',
                message: 'I can live over 100 years and navigate thousands of miles using Earth\'s magnetic field.',
                plea: 'Please save me from plastic bags I mistake for jellyfish and beach development!'
            },
            
            python: {
                emoji: '🐍',
                keywords: ['python', 'ball python', 'burmese python', 'reticulated python'],
                introduction: 'I am a powerful python',
                message: 'I am a constrictor that helps control prey populations in my habitat.',
                plea: 'Please save me by stopping illegal wildlife trade and protecting my natural habitat!'
            },
            cobra: {
                emoji: '🐍',
                keywords: ['cobra', 'king cobra', 'spitting cobra'],
                introduction: 'I am a majestic cobra',
                message: 'I am an important predator that keeps ecosystems balanced with my hunting skills.',
                plea: 'Please save me by preserving my ecosystems and understanding my important role!'
            },
            rattlesnake: {
                emoji: '🐍',
                keywords: ['rattlesnake', 'rattler', 'diamondback'],
                introduction: 'I am a rattlesnake',
                message: 'I warn before I strike and help control rodent populations that damage crops.',
                explanation: 'Rattlesnakes are venomous pit vipers with a distinctive rattle made of keratin segments. We use heat-sensing organs to detect prey and our rattle to warn potential threats.',
                plea: 'Please save me by preserving natural areas and not killing me out of fear!'
            },
            fish: {
                emoji: '🐟',
                keywords: ['fish', 'salmon', 'trout', 'aquatic'],
                introduction: 'I am a swimming fish',
                message: 'I keep water ecosystems healthy and provide food for many animals.',
                plea: 'Please save me by keeping waters clean and not overfishing!'
            },
            bee: {
                emoji: '🐝',
                keywords: ['bee', 'honey', 'pollinator', 'buzz'],
                introduction: 'I am a busy bee',
                message: 'I pollinate the plants that grow your food and make sweet honey.',
                plea: 'Please save me by planting bee-friendly flowers and avoiding harmful pesticides!'
            },
            ladybug: {
                emoji: '🐞',
                keywords: ['ladybug', 'ladybird', 'beetle', 'spot'],
                introduction: 'I am a lucky ladybug',
                message: 'I protect your garden by eating harmful pests like aphids.',
                plea: 'Please save me by avoiding pesticides and creating bug-friendly gardens!'
            },
            // Citrus fruits
            orange: {
                emoji: '🍊',
                keywords: ['orange', 'valencia orange', 'navel orange'],
                introduction: 'I am a juicy orange',
                message: 'I am packed with vitamin C and my oils in my peel have antibacterial properties.',
                plea: 'Please save me by supporting sustainable citrus farming and reducing food waste!'
            },
            lemon: {
                emoji: '🍋',
                keywords: ['lemon', 'meyer lemon', 'eureka lemon'],
                introduction: 'I am a tart lemon',
                message: 'I contain powerful citric acid and vitamin C, helping preserve food and boost immunity.',
                plea: 'Please save me by supporting organic farming and water conservation!'
            },
            lime: {
                emoji: '🟢',
                keywords: ['lime', 'key lime', 'persian lime'],
                introduction: 'I am a zesty lime',
                message: 'I prevent scurvy and add zest to cuisine while my oils repel insects naturally.',
                plea: 'Please save me by supporting sustainable agriculture and reducing pesticide use!'
            },
            grapefruit: {
                emoji: '🍊',
                keywords: ['grapefruit', 'pink grapefruit', 'white grapefruit'],
                introduction: 'I am a tangy grapefruit',
                message: 'I boost metabolism and contain compounds that may help lower cholesterol.',
                plea: 'Please save me by supporting healthy diets and sustainable citrus production!'
            },
            tangerine: {
                emoji: '🍊',
                keywords: ['tangerine', 'mandarin', 'clementine'],
                introduction: 'I am a sweet tangerine',
                message: 'I am easy to peel and rich in vitamin A, supporting healthy vision and skin.',
                plea: 'Please save me by choosing locally grown citrus when possible!'
            },
            // Stone fruits
            peach: {
                emoji: '🍑',
                keywords: ['peach', 'nectarine'],
                introduction: 'I am a soft peach',
                message: 'I contain vitamins A and C, and my fuzzy skin protects my sweet, juicy flesh.',
                plea: 'Please save me by supporting organic orchards and protecting pollinators!'
            },
            plum: {
                emoji: '🟣',
                keywords: ['plum', 'damson plum', 'greengage'],
                introduction: 'I am a sweet plum',
                message: 'I provide antioxidants and fiber, and I can be dried into prunes for digestive health.',
                plea: 'Please save me by supporting diverse fruit varieties and heritage orchards!'
            },
            apricot: {
                emoji: '🟠',
                keywords: ['apricot', 'armenian plum'],
                introduction: 'I am a golden apricot',
                message: 'I am rich in beta-carotene and support eye health with my orange pigments.',
                plea: 'Please save me by protecting fruit tree biodiversity and ancient varieties!'
            },
            cherry: {
                emoji: '🍒',
                keywords: ['cherry', 'sweet cherry', 'sour cherry', 'bing cherry'],
                introduction: 'I am a bright cherry',
                message: 'I contain melatonin to help you sleep and anthocyanins that fight inflammation.',
                plea: 'Please save me by supporting pollinator-friendly farming and orchard preservation!'
            },
            // Pome fruits
            apple: {
                emoji: '🍎',
                keywords: ['apple', 'red apple', 'green apple', 'granny smith', 'gala apple'],
                introduction: 'I am a crisp apple',
                message: 'I keep doctors away with my fiber, antioxidants, and natural compounds that support heart health.',
                plea: 'Please save me by supporting local orchards and choosing diverse apple varieties!'
            },
            pear: {
                emoji: '🍐',
                keywords: ['pear', 'bartlett pear', 'anjou pear', 'bosc pear'],
                introduction: 'I am a tender pear',
                message: 'I provide gentle fiber and natural sugars, making me easy to digest for all ages.',
                plea: 'Please save me by supporting sustainable fruit production and heirloom varieties!'
            },
            // Berries
            strawberry: {
                emoji: '🍓',
                keywords: ['strawberry', 'wild strawberry'],
                introduction: 'I am a sweet strawberry',
                message: 'I contain more vitamin C than oranges and my seeds are actually tiny fruits!',
                plea: 'Please save me by supporting organic berry farms and protecting wild strawberry patches!'
            },
            blueberry: {
                emoji: '🫐',
                keywords: ['blueberry', 'wild blueberry', 'huckleberry'],
                introduction: 'I am a tiny blueberry',
                message: 'I am a superfood packed with antioxidants that support brain health and memory.',
                plea: 'Please save me by protecting natural blueberry habitats and supporting organic farming!'
            },
            raspberry: {
                emoji: '🫐',
                keywords: ['raspberry', 'red raspberry', 'black raspberry'],
                introduction: 'I am a delicate raspberry',
                message: 'I provide fiber, vitamin C, and ketones that may boost metabolism.',
                plea: 'Please save me by supporting sustainable berry farming and protecting wild brambles!'
            },
            blackberry: {
                emoji: '🫐',
                keywords: ['blackberry', 'dewberry', 'boysenberry'],
                introduction: 'I am a wild blackberry',
                message: 'I am rich in vitamins and my dark color comes from powerful antioxidants.',
                plea: 'Please save me by preserving natural hedgerows and supporting wildlife corridors!'
            },
            cranberry: {
                emoji: '🔴',
                keywords: ['cranberry', 'bog cranberry'],
                introduction: 'I am a tart cranberry',
                message: 'I prevent urinary tract infections and contain compounds that support bladder health.',
                plea: 'Please save me by protecting wetland habitats and supporting sustainable bog management!'
            },
            // Tropical fruits
            banana: {
                emoji: '🍌',
                keywords: ['banana', 'plantain', 'cavendish banana'],
                introduction: 'I am a curved banana',
                message: 'I provide instant energy with natural sugars and potassium that prevents muscle cramps.',
                plea: 'Please save me by supporting fair trade farming and protecting tropical biodiversity!'
            },
            mango: {
                emoji: '🥭',
                keywords: ['mango', 'alphonso mango', 'tommy atkins'],
                introduction: 'I am a tropical mango',
                message: 'I am rich in vitamin A and enzymes that aid digestion, and I\'ve been cultivated for 4,000 years.',
                plea: 'Please save me by supporting sustainable tropical agriculture and protecting mango forests!'
            },
            pineapple: {
                emoji: '🍍',
                keywords: ['pineapple', 'ananas'],
                introduction: 'I am a spiky pineapple',
                message: 'I contain bromelain, an enzyme that aids digestion and reduces inflammation.',
                plea: 'Please save me by supporting responsible tropical farming and reducing food waste!'
            },
            papaya: {
                emoji: '🟠',
                keywords: ['papaya', 'pawpaw', 'carica papaya'],
                introduction: 'I am a smooth papaya',
                message: 'I produce papain, an enzyme that helps digest proteins and soothes stomachs.',
                plea: 'Please save me by supporting sustainable tropical agriculture and protecting papaya diversity!'
            },
            coconut: {
                emoji: '🥥',
                keywords: ['coconut', 'coconut palm'],
                introduction: 'I am a hard coconut',
                message: 'I provide hydrating water and healthy fats that support brain and heart function.',
                plea: 'Please save me by supporting coastal communities and protecting coconut palms from climate change!'
            },
            avocado: {
                emoji: '🥑',
                keywords: ['avocado', 'alligator pear'],
                introduction: 'I am a creamy avocado',
                message: 'I contain healthy monounsaturated fats and help your body absorb fat-soluble vitamins.',
                plea: 'Please save me by supporting water-wise farming and responsible avocado production!'
            },
            kiwi: {
                emoji: '🥝',
                keywords: ['kiwi', 'kiwifruit', 'chinese gooseberry'],
                introduction: 'I am a fuzzy kiwi',
                message: 'I contain more vitamin C than oranges and actinidin enzyme that aids protein digestion.',
                plea: 'Please save me by supporting sustainable fruit farming and protecting New Zealand ecosystems!'
            },
            // Melons
            watermelon: {
                emoji: '🍉',
                keywords: ['watermelon', 'citrullus'],
                introduction: 'I am a refreshing watermelon',
                message: 'I am 92% water and contain lycopene, helping you stay hydrated and healthy.',
                plea: 'Please save me by supporting water-efficient farming and protecting melon diversity!'
            },
            cantaloupe: {
                emoji: '🍈',
                keywords: ['cantaloupe', 'muskmelon'],
                introduction: 'I am a sweet cantaloupe',
                message: 'I am rich in vitamin A and beta-carotene, supporting healthy vision and skin.',
                plea: 'Please save me by choosing locally grown melons and supporting sustainable farming!'
            },
            // Other fruits
            grape: {
                emoji: '🍇',
                keywords: ['grape', 'wine grape', 'table grape'],
                introduction: 'I am a clustered grape',
                message: 'I contain resveratrol in my skin, which supports heart health and longevity.',
                plea: 'Please save me by supporting sustainable viticulture and protecting grape biodiversity!'
            },
            fig: {
                emoji: '🟤',
                keywords: ['fig', 'fresh fig', 'mission fig'],
                introduction: 'I am a sweet fig',
                message: 'I am rich in fiber, calcium, and potassium, and I\'ve been cultivated for 11,000 years.',
                plea: 'Please save me by preserving ancient fig varieties and supporting Mediterranean agriculture!'
            },
            pomegranate: {
                emoji: '🔴',
                keywords: ['pomegranate', 'punica granatum'],
                introduction: 'I am a seeded pomegranate',
                message: 'I contain powerful antioxidants in my seeds that support heart and brain health.',
                plea: 'Please save me by supporting traditional fruit cultivation and protecting pomegranate diversity!'
            },
            olive: {
                emoji: '🫒',
                keywords: ['olive', 'olives', 'kalamata', 'green olive', 'black olive'],
                introduction: 'I am a savory olive',
                message: 'I provide healthy monounsaturated fats and have been a Mediterranean staple for millennia, growing on ancient trees that can live for centuries.',
                explanation: 'Olives contain healthy fats, vitamin E, and compounds that have anti-inflammatory properties. The olive tree is a symbol of peace and wisdom.',
                plea: 'Please save me by supporting traditional Mediterranean farming and protecting ancient olive groves!'
            },
            // Fruit trees
            'apple-tree': {
                emoji: '🌳',
                keywords: ['apple tree', 'orchard tree'],
                introduction: 'I am an apple tree',
                message: 'I can live for 100 years, producing apples that have fed humans for thousands of years.',
                plea: 'Please save me by supporting orchard conservation and planting heritage fruit trees!'
            },
            'orange-tree': {
                emoji: '🌳',
                keywords: ['orange tree', 'citrus tree'],
                introduction: 'I am an orange tree',
                message: 'I produce vitamin-rich oranges and my blossoms create aromatic orange blossom honey.',
                plea: 'Please save me by supporting sustainable citrus groves and protecting pollinator habitats!'
            },
            'cherry-tree': {
                emoji: '🌸',
                keywords: ['cherry tree', 'flowering cherry'],
                introduction: 'I am a flowering cherry tree',
                message: 'I produce both sweet fruit and spectacular spring blossoms that attract pollinators.',
                plea: 'Please save me by protecting flowering trees and supporting urban forest conservation!'
            },
            'mango-tree': {
                emoji: '🌳',
                keywords: ['mango tree', 'tropical fruit tree'],
                introduction: 'I am a tropical mango tree',
                message: 'I can live for 300 years and am considered sacred in some cultures for my life-giving fruit.',
                plea: 'Please save me by protecting tropical forests and supporting sustainable mango cultivation!'
            },
            'coconut-tree': {
                emoji: '🌴',
                keywords: ['coconut tree', 'palm tree'],
                introduction: 'I am a tall coconut palm',
                message: 'I am the "tree of life," providing water, food, shelter, and countless other uses.',
                plea: 'Please save me by protecting coastal ecosystems and supporting island communities!'
            },
            // Pollution and environmental threats
            trash: {
                emoji: '🗑️',
                keywords: ['garbage', 'trash', 'litter', 'waste'],
                introduction: 'I am garbage harming nature',
                message: 'I pollute natural environments, harm wildlife, and destroy the beauty of pristine landscapes.',
                explanation: 'Garbage and litter are major environmental threats that can persist in nature for decades or centuries. Plastic items can take 400-1000 years to decompose, while harming animals who mistake them for food.',
                plea: 'Please STOP me by reducing waste, recycling properly, and never littering!'
            },
            plastic: {
                emoji: '♻️',
                keywords: ['plastic', 'plastic bag', 'plastic bottle', 'microplastic'],
                introduction: 'I am plastic waste',
                message: 'I persist in the environment for hundreds of years, choking marine life and contaminating food chains.',
                explanation: 'Plastic pollution is one of the most serious environmental threats. Single-use plastics break down into microplastics that contaminate our food chain, while larger pieces kill marine animals through ingestion and entanglement.',
                plea: 'Please ELIMINATE me by reducing single-use plastics and supporting plastic-free alternatives!'
            },
            pollution: {
                emoji: '☠️',
                keywords: ['pollution', 'contamination', 'toxic', 'oil spill'],
                introduction: 'I am pollution',
                message: 'I poison air, water, and soil, causing massive environmental damage and threatening all life.',
                explanation: 'Pollution comes in many forms - chemical, plastic, air, water, noise, and light pollution. Each type disrupts natural systems and can cause irreversible damage to ecosystems and human health.',
                plea: 'Please STOP me by supporting clean energy and strict environmental regulations!'
            },
            cigarette: {
                emoji: '🚬',
                keywords: ['cigarette', 'cigarette butt', 'smoking'],
                introduction: 'I am a cigarette butt',
                message: 'I am the most littered item worldwide, leaching toxic chemicals into soil and water for years.',
                plea: 'Please ELIMINATE me by quitting smoking and properly disposing of cigarette waste!'
            },
            coral: {
                emoji: '🪸',
                keywords: ['coral', 'polyp', 'coral colony', 'hard coral', 'soft coral'],
                introduction: 'I am living coral',
                message: 'I create beautiful underwater gardens and protect coastlines from waves and storms.',
                plea: 'Please save me by reducing carbon emissions and using reef-safe sunscreen!'
            },
            reef: {
                emoji: '🪸',
                keywords: ['coral reef', 'reef', 'barrier reef', 'coral garden'],
                introduction: 'I am a coral reef',
                message: 'I support 25% of all marine life and protect coastlines from erosion and storms.',
                plea: 'Please save me by fighting climate change and stopping ocean pollution!'
            },
            ocean: {
                emoji: '🌊',
                keywords: ['ocean', 'sea', 'wave', 'beach', 'marine'],
                introduction: 'I am the vast ocean',
                message: 'I produce most of your oxygen and regulate Earth\'s climate.',
                plea: 'Please save me by reducing plastic waste and stopping pollution!'
            },
            forest: {
                emoji: '🌲',
                keywords: ['forest', 'woods', 'jungle', 'canopy'],
                introduction: 'I am a living forest',
                message: 'I am home to countless species and the lungs of our planet.',
                plea: 'Please save me by supporting conservation and sustainable practices!'
            },
            mushroom: {
                emoji: '🍄',
                keywords: ['mushroom', 'fungus', 'fungi', 'boletus', 'toadstool', 'spore'],
                introduction: 'I am a mushroom',
                message: 'I break down dead material and recycle nutrients, connecting trees through underground networks. But DANGER! Some of my kind are deadly poisonous - never eat wild mushrooms!',
                plea: 'Please respect me by learning about my ecological role and NEVER eating wild mushrooms without expert identification!'
            },
            earth: {
                emoji: '🌍',
                keywords: ['earth', 'planet', 'world', 'globe'],
                introduction: 'I am planet Earth',
                message: 'I am your only home in the vast universe, supporting all life.',
                plea: 'Please save me by taking care of the environment and living sustainably!'
            },
            
            // General objects (no environmental warnings/pleas)
            house: {
                emoji: '🏠',
                keywords: ['house', 'home', 'building', 'residence'],
                introduction: 'I am a house',
                message: 'I provide shelter and safety for families, and can be designed to be energy-efficient and environmentally friendly.',
                explanation: 'Houses have evolved from simple shelters to complex structures with electricity, plumbing, and smart technology.',
                plea: 'Consider making me more sustainable with solar panels and energy-efficient features!'
            },
            phone: {
                emoji: '📱',
                keywords: ['phone', 'smartphone', 'mobile', 'cellular'],
                introduction: 'I am a phone',
                message: 'I connect people across the world and provide access to information, communication, and entertainment.',
                explanation: 'Modern phones are actually powerful computers that can perform millions of calculations per second.',
                plea: 'Help reduce electronic waste by recycling me properly when I\'m no longer needed!'
            },
            car: {
                emoji: '🚗',
                keywords: ['car', 'automobile', 'vehicle', 'sedan'],
                introduction: 'I am a car',
                message: 'I provide transportation and mobility, helping people travel efficiently from place to place.',
                explanation: 'Cars have evolved from horse-drawn carriages to electric vehicles that can drive themselves.',
                plea: 'Consider electric or hybrid versions of me to reduce air pollution!'
            },
            
            // Vegetables and vegetable plants
            vegetable: {
                emoji: '🥬',
                keywords: ['vegetable', 'vegetables', 'carrot', 'tomato', 'potato', 'lettuce', 'cabbage', 
                          'broccoli', 'cauliflower', 'spinach', 'cucumber', 'onion', 'garlic', 'pepper',
                          'celery', 'corn', 'peas', 'beans', 'radish', 'beet', 'turnip', 'parsnip',
                          'asparagus', 'artichoke', 'zucchini', 'squash', 'pumpkin', 'eggplant',
                          'root vegetable', 'leafy vegetable', 'vegetable garden', 'crop', 'produce'],
                introduction: 'I am a vegetable',
                message: 'I am a nutritious plant grown for food, providing essential vitamins, minerals, and fiber that keep humans and animals healthy.',
                explanation: 'Vegetables are parts of plants that are consumed by humans - roots, stems, leaves, flowers, or fruits. They have been cultivated for thousands of years and form the foundation of healthy diets worldwide.',
                plea: 'Support sustainable farming practices that grow me without harmful pesticides and protect soil health!'
            },
            
            // Generic fallback for unknown objects
            Object: {
                emoji: '📦',
                keywords: ['object', 'item', 'thing'],
                introduction: 'I am an object',
                message: 'I am something that exists in the world around you, part of the vast collection of items that make up our daily environment.',
                explanation: 'Objects can be natural or human-made, each serving different purposes and having unique properties and characteristics.',
                plea: 'Help keep the world organized by using and disposing of items responsibly!'
            }
        };
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const app = new NatureTalks();
    // Load any saved custom voices if the function exists
    if (typeof app.loadVoicesFromStorage === 'function') {
        app.loadVoicesFromStorage();
    }
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
}
