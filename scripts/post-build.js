const fs = require('fs');
const path = require('path');

// Ensure dist/public directory exists
const publicDir = path.join(__dirname, '..', 'dist', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('✅ Created dist/public directory');
}

// Copy index.html
const source = path.join(__dirname, '..', 'public', 'index.html');
const dest = path.join(publicDir, 'index.html');
fs.copyFileSync(source, dest);
console.log('✅ Copied index.html to dist/public/');


