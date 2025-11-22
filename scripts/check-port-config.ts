/**
 * Script to check port configuration mismatch
 * Checks: Dockerfile EXPOSE, health check port, main.ts default port
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 Checking port configuration...\n');

const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
const mainTsPath = path.join(__dirname, '..', 'src', 'main.ts');

// Check Dockerfile
console.log('📋 [1] Dockerfile Configuration:');
if (fs.existsSync(dockerfilePath)) {
  const dockerfile = fs.readFileSync(dockerfilePath, 'utf-8');
  
  // Find EXPOSE port
  const exposeMatch = dockerfile.match(/EXPOSE\s+(\d+)/);
  if (exposeMatch) {
    console.log(`   ✅ EXPOSE: ${exposeMatch[1]}`);
  } else {
    console.log('   ❌ EXPOSE not found');
  }
  
  // Find health check port
  const healthCheckMatch = dockerfile.match(/localhost:(\d+)\/health/);
  if (healthCheckMatch) {
    console.log(`   ✅ Health check port: ${healthCheckMatch[1]}`);
  } else {
    console.log('   ❌ Health check port not found');
  }
} else {
  console.log('   ❌ Dockerfile not found');
}

// Check main.ts
console.log('\n📋 [2] main.ts Configuration:');
if (fs.existsSync(mainTsPath)) {
  const mainTs = fs.readFileSync(mainTsPath, 'utf-8');
  
  // Find default port
  const portMatch = mainTs.match(/const port = process\.env\.PORT \|\| (\d+)/);
  if (portMatch) {
    console.log(`   ✅ Default port: ${portMatch[1]}`);
  } else {
    console.log('   ❌ Default port not found');
  }
  
  // Check if PORT env var is used
  if (mainTs.includes('process.env.PORT')) {
    console.log('   ✅ Uses PORT environment variable');
  } else {
    console.log('   ❌ Does not use PORT environment variable');
  }
} else {
  console.log('   ❌ main.ts not found');
}

// Check App Runner environment variables
console.log('\n📋 [3] App Runner Configuration:');
console.log('   ⚠️  Check App Runner console for PORT environment variable');
console.log('   📝 App Runner usually sets PORT to 8080 by default');
console.log('   📝 If not set, your app will use default from main.ts');

// Summary
console.log('\n📊 Summary:');
console.log('   ┌─────────────────────────────────────┐');
console.log('   │ Potential Issues:                   │');
console.log('   ├─────────────────────────────────────┤');
console.log('   │ ❌ Health check hardcoded to 3000   │');
console.log('   │ ❌ If App Runner sets PORT=8080,    │');
console.log('   │    health check will fail           │');
console.log('   └─────────────────────────────────────┘');

console.log('\n✅ To fix: Make health check use PORT env var or remove hardcoded port');

