class NatureTalks {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.natureDatabase = this.createNatureDatabase();
        
        // Clarifai API configuration
        this.clarifaiConfig = {
            apiKey: '554a0303cb8c494f90827f35719591e9',
            userId: 'clarifai',
            appId: 'main',
            modelId: 'general-image-recognition',
            modelVersionId: 'aa7f35c01e0642fda5cf400f543e7c40', // Correct version ID
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
                const file = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' });
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
        
        // Ensure we always have a valid object name
        let finalObjectName = objectName;
        if (!objectName || objectName === 'unknown' || objectName === '') {
            finalObjectName = 'tree'; // Default fallback
        }
        
        // More comprehensive mapping with better priority
        let matchedCategory = this.findBestMatch(finalObjectName, identifiedObject.allConcepts || []);
        
        // Ensure we have a valid category
        if (!this.natureDatabase[matchedCategory]) {
            matchedCategory = 'tree'; // Safe fallback
        }
        
        console.log('📂 Matched category:', matchedCategory);
        
        // Create completely custom message based on detected object
        const dynamicMessage = {
            emoji: this.getObjectEmoji(finalObjectName),
            confidence: confidence,
            detectedAs: identifiedObject.name || 'nature object',
            originalDetection: identifiedObject.name || finalObjectName,
            introduction: this.generateSpecificIntroduction(finalObjectName),
            message: this.generateSpecificMessage(finalObjectName),
            consequences: this.generateConsequences(finalObjectName),
            plea: this.generateSpecificPlea(finalObjectName)
        };
        
        console.log('✅ Generated dynamic message:', dynamicMessage);
        
        return dynamicMessage;
    }

    findBestMatch(objectName, allConcepts) {
        // Create priority-based matching
        const allTerms = [objectName, ...allConcepts.map(c => c.toLowerCase())];
        
        console.log('🔍 All terms for matching:', allTerms); // Debug log
        
        // Define matching rules with priority - expanded tree detection
        const matchingRules = [
            // Trees (highest priority - expanded list for Clarifai terms)
            { 
                terms: [
                    // General tree terms
                    'tree', 'trees', 'wood', 'timber', 'lumber', 'log', 'woody plant',
                    // Tree parts
                    'trunk', 'bark', 'branch', 'branches', 'twig', 'stem', 'root', 'roots',
                    'leaf', 'leaves', 'foliage', 'canopy', 'crown',
                    // Specific tree types
                    'oak', 'pine', 'maple', 'birch', 'apple', 'cherry', 'willow', 'elm', 
                    'cedar', 'fir', 'spruce', 'poplar', 'ash', 'beech', 'hickory', 'walnut',
                    // Tree groupings
                    'grove', 'orchard', 'forest', 'woods', 'woodland', 'forestry',
                    // Plant-related that usually means trees
                    'deciduous', 'coniferous', 'evergreen', 'hardwood', 'softwood',
                    // Nature terms often associated with trees
                    'plant', 'vegetation', 'flora', 'growth', 'green', 'nature'
                ], 
                category: 'tree' 
            },
            // Water plants vs flowers (lotus, water lily are water plants, not typical flowers)
            { terms: ['lotus', 'water lily', 'lily pad', 'pond plant', 'aquatic plant'], category: 'river' },
            // Specific flowers
            { terms: ['rose', 'tulip', 'sunflower', 'carnation', 'chrysanthemum', 'petunia', 'marigold', 'daisy', 'lily'], category: 'flower' },
            // Generic flower terms (lower priority than specific types)
            { terms: ['flower', 'bloom', 'petal', 'blossom', 'bouquet', 'floral'], category: 'flower' },
            { terms: ['ocean', 'sea', 'reef', 'coral', 'marine'], category: 'ocean' },
            { terms: ['water', 'river', 'stream', 'lake', 'pond'], category: 'river' },
            { terms: ['bird', 'eagle', 'sparrow', 'robin', 'owl', 'hawk'], category: 'bird' },
            { terms: ['butterfly', 'moth'], category: 'butterfly' },
            { terms: ['bee', 'honeybee', 'bumblebee'], category: 'bee' },
            { terms: ['rabbit', 'bunny', 'hare', 'animal', 'mammal', 'wildlife'], category: 'bear' },
            { terms: ['mushroom', 'fungus', 'fungi', 'boletus', 'toadstool', 'edible agaric', 'spore', 'mycelium'], category: 'mushroom' },
            { terms: ['fish', 'salmon', 'trout'], category: 'fish' },
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
                    if (term.includes(ruleTerm) || ruleTerm.includes(term)) {
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
        
        if (bestMatch) {
            console.log('Final match:', bestMatch, 'with score:', bestScore);
            return bestMatch;
        }
        
        // Enhanced fallback based on the primary detected object
        const primaryTerm = allTerms[0] || '';
        console.log('No rule matches, using enhanced fallback for:', primaryTerm);
        
        // Smart fallback classifications
        if (primaryTerm.includes('tree') || primaryTerm.includes('wood') || primaryTerm.includes('bark')) {
            return 'tree';
        } else if (primaryTerm.includes('flower') || primaryTerm.includes('bloom') || primaryTerm.includes('petal')) {
            return 'flower';
        } else if (primaryTerm.includes('water') || primaryTerm.includes('pond') || primaryTerm.includes('lake')) {
            return 'river';
        } else if (primaryTerm.includes('animal') || primaryTerm.includes('mammal') || primaryTerm.includes('pet')) {
            return 'bear'; // Using bear as generic animal category
        }
        
        // Final fallback
        return 'earth';
    }

    getObjectEmoji(objectName) {
        const emojiMap = {
            // Trees and plants
            tree: '🌳', oak: '🌳', pine: '🌲', apple: '🍎', leaf: '🍃', plant: '🌱',
            bark: '🌳', trunk: '🌳', branch: '🌿',
            
            // Flowers
            flower: '🌸', rose: '🌹', tulip: '🌷', sunflower: '🌻',
            bloom: '🌺', blossom: '🌸', petal: '🌸',
            
            // Water
            ocean: '🌊', sea: '🌊', water: '💧', river: '🏞️', lake: '🏞️',
            stream: '🏞️', reef: '🪸', coral: '🪸', lotus: '🪷', lily: '🪷',
            
            // Animals
            rabbit: '🐰', bunny: '🐰', hare: '🐰', bear: '🐻',
            bird: '🐦', eagle: '🦅', owl: '🦉', fish: '🐟',
            butterfly: '🦋', bee: '🐝', animal: '🐾',
            
            // Landscapes
            mountain: '⛰️', hill: '🏔️', rock: '🪨', stone: '🪨',
            sky: '☁️', cloud: '☁️', forest: '🌲',
            
            // Default
            nature: '🌍'
        };
        
        // Find best emoji match
        for (const [key, emoji] of Object.entries(emojiMap)) {
            if (objectName.includes(key) || key.includes(objectName)) {
                return emoji;
            }
        }
        
        return '🌍'; // Default nature emoji
    }

    generateSpecificIntroduction(objectName) {
        const introductions = {
            // Trees and plants
            tree: 'I am a mighty tree',
            oak: 'I am a strong oak tree',
            pine: 'I am an evergreen pine tree',
            apple: 'I am a fruitful apple tree',
            leaf: 'I am a green leaf',
            bark: 'I am protective tree bark',
            plant: 'I am a growing plant',
            
            // Flowers
            flower: 'I am a beautiful flower',
            rose: 'I am a fragrant rose',
            tulip: 'I am a colorful tulip',
            sunflower: 'I am a bright sunflower',
            
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
        
        // Find best match
        for (const [key, intro] of Object.entries(introductions)) {
            if (objectName.includes(key) || key.includes(objectName)) {
                return intro;
            }
        }
        
        return `I am ${objectName}`;
    }

    generateSpecificMessage(objectName) {
        const messages = {
            // Trees and plants
            tree: 'I produce oxygen, provide shade, and create homes for countless creatures.',
            oak: 'I grow strong and tall, living for centuries and supporting entire ecosystems.',
            pine: 'I stay green all year and provide shelter even in winter.',
            apple: 'I bloom with beautiful flowers in spring and produce delicious, nutritious fruit for humans and wildlife.',
            leaf: 'I capture sunlight and turn it into food through photosynthesis.',
            bark: 'I protect the tree from insects and weather while storing nutrients.',
            
            // Flowers
            flower: 'I attract pollinators and spread beauty throughout the world.',
            rose: 'I represent love and beauty while providing nectar for bees.',
            tulip: 'I herald the arrival of spring with my vibrant colors.',
            sunflower: 'I turn my face to follow the sun and provide nutritious seeds.',
            
            // Water
            ocean: 'I produce most of Earth\'s oxygen and regulate the global climate.',
            sea: 'I am home to countless marine species and provide food for humanity.',
            reef: 'I build underwater cities that support 25% of all marine life.',
            coral: 'I create beautiful underwater gardens and protect coastlines.',
            water: 'I am essential for all life and cycle endlessly through nature.',
            river: 'I carry fresh water from mountains to seas, supporting all life along my path.',
            lotus: 'I bloom beautifully on water surfaces and symbolize purity and rebirth in many cultures.',
            lily: 'I float gracefully on ponds and provide landing pads for frogs and shelter for fish.',
            
            // Animals
            rabbit: 'I help spread seeds and serve as food for many predators in the ecosystem.',
            bunny: 'I bring joy to children and help maintain grassland ecosystems.',
            bear: 'I spread seeds through the forest and keep animal populations balanced.',
            bird: 'I pollinate plants, spread seeds, and control insect populations.',
            eagle: 'I soar high above as a symbol of freedom and wilderness.',
            butterfly: 'I pollinate flowers and transform from caterpillar in amazing metamorphosis.',
            bee: 'I pollinate 1/3 of all the food you eat and create sweet honey.',
            fish: 'I keep aquatic ecosystems healthy and provide protein for many animals.',
            
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
        
        // Find best match
        for (const [key, message] of Object.entries(messages)) {
            if (objectName.includes(key) || key.includes(objectName)) {
                return message;
            }
        }
        
        return 'I play an important role in the balance of nature.';
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
        
        // Find best match
        for (const [key, plea] of Object.entries(pleas)) {
            if (objectName.includes(key) || key.includes(objectName)) {
                // Modify plea based on harmful vs beneficial
                if (this.isHarmfulObject(objectName)) {
                    // Change "Please save" to "Please avoid" or "Please eliminate" for harmful objects
                    return plea.replace(/Please save/g, 'Please avoid').replace(/Please SAVE/g, 'Please ELIMINATE');
                }
                return plea;
            }
        }
        
        // Default fallback with appropriate action
        if (this.isHarmfulObject(objectName)) {
            return 'Please avoid me by reducing pollution and stopping environmental destruction!';
        } else {
            return 'Please save nature by protecting the environment and stopping destruction!';
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

    displayNatureMessage(natureData) {
        this.natureAvatar.textContent = natureData.emoji;
        this.natureTitle.textContent = `Hello! ${natureData.introduction}`;
        
        // Include consequences in the message display
        const fullMessage = `${natureData.message} ${natureData.consequences ? 'But ' + natureData.consequences + ' ' : ''}${natureData.plea}`;
        this.natureText.textContent = fullMessage;
        
        // Include consequences in the spoken message
        this.currentMessage = `${natureData.introduction}. ${natureData.message} ${natureData.consequences ? 'But ' + natureData.consequences + ' ' : ''}${natureData.plea}`;
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
            tree: {
                emoji: '🌳',
                keywords: ['tree', 'oak', 'pine', 'maple', 'birch', 'forest', 'wood'],
                introduction: 'I am a mighty tree',
                message: 'I give you oxygen to breathe, shade to rest under, and homes for countless creatures.',
                plea: 'Please save me by not cutting down forests and planting more trees!'
            },
            flower: {
                emoji: '🌸',
                keywords: ['flower', 'rose', 'tulip', 'daisy', 'bloom', 'petal'],
                introduction: 'I am a beautiful flower',
                message: 'I bring color to your world and help bees make honey.',
                plea: 'Please save me by not picking wildflowers and protecting pollinator habitats!'
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
                keywords: ['butterfly', 'moth', 'insect', 'wing'],
                introduction: 'I am a delicate butterfly',
                message: 'I pollinate flowers and transform from a caterpillar in an amazing metamorphosis.',
                plea: 'Please save me by planting native flowers and avoiding pesticides!'
            },
            bear: {
                emoji: '🐻',
                keywords: ['bear', 'animal', 'mammal', 'wildlife'],
                introduction: 'I am a powerful bear',
                message: 'I help spread seeds through the forest and keep ecosystems balanced.',
                plea: 'Please save me by protecting wilderness areas and securing your garbage!'
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
            ocean: {
                emoji: '🌊',
                keywords: ['ocean', 'sea', 'wave', 'beach', 'coral'],
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