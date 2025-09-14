# Setting Up Real AI Image Recognition

To get actual image recognition (not hardcoded responses), follow these steps:

## Option 1: Clarifai API (Recommended)

1. **Get Free API Key:**
   - Go to https://clarifai.com/
   - Sign up for free account
   - Get API key from dashboard

2. **Add API Key:**
   - Open `script.js`
   - Find line 167: `'Authorization': 'Key YOUR_API_KEY'`
   - Replace `YOUR_API_KEY` with your actual key

3. **Enable CORS:**
   - For local testing, run with `--disable-web-security` flag
   - Or deploy to a web server

## Option 2: Google Vision API

```javascript
// Replace the identifyImageWithAPI function with:
async identifyImageWithAPI(imageData) {
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${YOUR_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requests: [{
                image: { content: imageData.split(',')[1] },
                features: [{ type: 'LABEL_DETECTION', maxResults: 10 }]
            }]
        })
    });
    
    const result = await response.json();
    const labels = result.responses[0].labelAnnotations;
    return {
        name: labels[0].description,
        confidence: labels[0].score,
        allConcepts: labels.map(l => l.description)
    };
}
```

## Option 3: Local AI (No API needed)

Currently implemented! The app uses:
- **Color Analysis**: Analyzes dominant colors in images
- **Smart Mapping**: Maps colors to nature types
  - Green → Plants/Trees
  - Blue → Water/Rivers  
  - Brown → Earth/Mountains
  - White → Sky/Clouds

## Current Behavior:

✅ **Without API**: Uses color analysis + smart detection
✅ **With API**: Uses real AI + dynamic messages based on actual objects detected

## How It Works:

1. **Capture Image** → Analyze colors/pixels
2. **Detect Object Type** → Map to nature category  
3. **Generate Dynamic Message** → Create personalized response
4. **Specific Information** → Based on actual detected object

Example outputs:
- Photo of oak tree → "I am an oak tree. I am especially strong and can live for centuries..."
- Photo of rose → "I am a lovely rose. I create beautiful fragrances..."
- Photo of eagle → "I am an eagle. I soar high above and represent freedom..."

The app now provides **real object-specific information** instead of random responses!