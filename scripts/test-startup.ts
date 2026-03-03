/**
 * Test script to simulate App Runner startup process
 * This will catch initialization errors before deployment
 * 
 * NOTE: This backend is STATELESS - no database required!
 * All data storage is handled by Munawar's backend.
 */

import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env file (same as main.ts) - try multiple locations
const envPaths = [
  join(__dirname, '..', '..', '.env'), // Root .env
  join(__dirname, '..', '.env'), // Backend .env
];

let envLoaded = false;
for (const envPath of envPaths) {
  console.log('📋 [Test Startup] Trying to load environment from:', envPath);
  const result = dotenv.config({ path: envPath });
  if (!result.error) {
    console.log('✅ [Test Startup] Environment file loaded from:', envPath);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('⚠️ [Test Startup] No .env file found - using system environment variables');
}

async function testStartup() {
  console.log('🧪 [Test Startup] Testing application startup...\n');
  console.log('📝 NOTE: This backend is STATELESS - no database required!');
  console.log('📝 All data storage is handled by Munawar\'s backend.\n');
  
  // Step 1: Check environment variables
  console.log('📋 [Step 1] Checking environment variables:');
  const requiredEnvVars = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    IOS_BACKEND_URL: process.env.IOS_BACKEND_URL,
    USE_IOS_BACKEND: process.env.USE_IOS_BACKEND,
    USE_IOS_EDNA: process.env.USE_IOS_EDNA,
    PORT: process.env.PORT || '8080',
  };
  
  const missing: string[] = [];
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (key === 'PORT') {
      console.log(`   - ${key}: ${value} (default)`);
    } else if (value) {
      // Mask sensitive values
      if (key.includes('KEY') || key.includes('PASSWORD') || key.includes('SECRET')) {
        const masked = value.length > 20 ? `${value.substring(0, 10)}...${value.substring(value.length - 5)}` : '***';
        console.log(`   - ${key}: ✅ Set (${masked})`);
      } else {
        console.log(`   - ${key}: ✅ Set (${value})`);
      }
    } else {
      console.log(`   - ${key}: ❌ Missing`);
      // OPENAI_API_KEY and IOS_BACKEND_URL are critical
      if (key === 'OPENAI_API_KEY' || key === 'IOS_BACKEND_URL') {
        missing.push(key);
      }
    }
  }
  
  if (missing.length > 0) {
    console.error(`\n❌ [Test Startup] Missing required environment variables: ${missing.join(', ')}`);
    console.error('❌ [Test Startup] App Runner deployment will fail without these!');
    process.exit(1);
  }
  
  console.log('\n✅ [Step 1] Required environment variables are set\n');
  
  // Step 2: Test NestJS module imports
  console.log('📋 [Step 2] Testing NestJS module imports...');
  try {
    // Test importing AppModule
    const { AppModule } = require('../src/app.module');
    console.log('✅ [Step 2] AppModule imported successfully');
    
    // Test importing main services
    const { ChatService } = require('../src/services/chat.service');
    const { IOSBackendService } = require('../src/services/ios-backend.service');
    console.log('✅ [Step 2] Core services imported successfully');
  } catch (error: any) {
    console.error('❌ [Step 2] Failed to import modules:', error.message);
    console.error('❌ [Step 2] This indicates a build or module structure issue');
    console.error('❌ [Step 2] Stack:', error.stack);
    process.exit(1);
  }
  
  // Step 3: Try to create NestJS application (this will test all DI and module initialization)
  console.log('\n📋 [Step 3] Testing NestJS application creation (this may take a moment)...');
  try {
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('../src/app.module');
    
    // Try to create the app (this will initialize all modules, services, guards, etc.)
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'], // Only show errors/warnings
    });
    
    console.log('✅ [Step 3] NestJS application created successfully');
    console.log('✅ [Step 3] All modules, services, and dependencies initialized');
    
    // Close the app
    await app.close();
  } catch (error: any) {
    console.error('❌ [Step 3] Failed to create NestJS application:');
    console.error('❌ [Step 3] Error:', error.message);
    console.error('❌ [Step 3] This is likely the error causing App Runner rollback!');
    console.error('❌ [Step 3] Full error:', error);
    if (error.stack) {
      console.error('❌ [Step 3] Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
  
  console.log('\n✅✅✅ [Test Startup] All startup tests passed! ✅✅✅');
  console.log('✅ [Test Startup] Application should start successfully in App Runner');
  console.log('\n📝 [Test Startup] Note: This test does not start the HTTP server');
  console.log('📝 [Test Startup] For full test, run: npm run start:prod\n');
}

// Run the test
testStartup().catch((error) => {
  console.error('❌ [Test Startup] Unhandled error:', error);
  process.exit(1);
});
