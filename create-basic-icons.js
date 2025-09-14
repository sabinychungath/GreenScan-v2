// Quick icon generator for PWA deployment
// Run with: node create-basic-icons.js

const fs = require('fs');

// Create simple SVG icons and convert to base64 PNG
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const createSVGIcon = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="grad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" style="stop-color:#4CAF50;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2E7D32;stop-opacity:1" />
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="15"/>
  <text x="50%" y="60%" text-anchor="middle" font-size="${size * 0.4}px" fill="white">🌿</text>
</svg>`;

// For now, create placeholder files that reference the SVG
sizes.forEach(size => {
  const svgContent = createSVGIcon(size);
  fs.writeFileSync(`icon-${size}.svg`, svgContent);
  
  // Create a simple HTML file that can generate PNG from SVG
  const htmlContent = `
<!DOCTYPE html>
<html><body>
<canvas id="canvas" width="${size}" height="${size}"></canvas>
<script>
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const gradient = ctx.createRadialGradient(${size/2}, ${size/2}, 0, ${size/2}, ${size/2}, ${size/2});
gradient.addColorStop(0, '#4CAF50');
gradient.addColorStop(1, '#2E7D32');
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, ${size}, ${size});
ctx.fillStyle = '#FFFFFF';
ctx.font = '${size * 0.6}px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('🌿', ${size/2}, ${size/2});
canvas.toBlob(blob => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'icon-${size}.png';
  a.click();
});
</script>
</body></html>`;
  
  fs.writeFileSync(`generate-icon-${size}.html`, htmlContent);
});

console.log('✅ Icon generators created! Open generate-icon-*.html files in browser to download PNG icons.');
console.log('📁 Files created:', sizes.map(s => `generate-icon-${s}.html`).join(', '));