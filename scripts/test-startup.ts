/**
 * Test script to simulate App Runner startup process
 * This will catch initialization errors before deployment
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
  
  // Step 1: Check environment variables
  console.log('📋 [Step 1] Checking environment variables:');
  const requiredEnvVars = {
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    PORT: process.env.PORT || '5000',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
  
  const missing: string[] = [];
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (key === 'PORT') {
      console.log(`   - ${key}: ${value} (default)`);
    } else if (value) {
      // Mask sensitive values
      if (key.includes('KEY') || key.includes('PASSWORD') || key === 'DATABASE_URL') {
        const masked = value.length > 20 ? `${value.substring(0, 10)}...${value.substring(value.length - 5)}` : '***';
        console.log(`   - ${key}: ✅ Set (${masked})`);
      } else {
        console.log(`   - ${key}: ✅ Set (${value})`);
      }
    } else {
      console.log(`   - ${key}: ❌ Missing`);
      if (key !== 'OPENAI_API_KEY') { // OPENAI_API_KEY is optional if other LLMs are used
        missing.push(key);
      }
    }
  }
  
  if (missing.length > 0) {
    console.error(`\n❌ [Test Startup] Missing required environment variables: ${missing.join(', ')}`);
    console.error('❌ [Test Startup] App Runner deployment will fail without these!');
    process.exit(1);
  }
  
  console.log('\n✅ [Step 1] All required environment variables are set\n');
  
  // Step 2: Test Supabase client initialization
  console.log('📋 [Step 2] Testing Supabase client initialization...');
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_ANON_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ [Step 2] Supabase client created successfully');
  } catch (error: any) {
    console.error('❌ [Step 2] Failed to create Supabase client:', error.message);
    console.error('❌ [Step 2] Stack:', error.stack);
    process.exit(1);
  }
  
  // Step 3: Test database URL parsing
  console.log('\n📋 [Step 3] Testing database URL parsing...');
  try {
    const databaseUrl = process.env.DATABASE_URL!;
    const url = new URL(databaseUrl);
    console.log('✅ [Step 3] Database URL parsed successfully');
    console.log(`   - Host: ${url.hostname}`);
    console.log(`   - Port: ${parseInt(url.port, 10) || 5432}`);
    console.log(`   - Database: ${url.pathname.slice(1)}`);
    console.log(`   - Username: ${url.username}`);
  } catch (error: any) {
    console.error('❌ [Step 3] Failed to parse DATABASE_URL:', error.message);
    console.error('❌ [Step 3] DATABASE_URL format should be: postgresql://user:password@host:port/database');
    process.exit(1);
  }
  
  // Step 4: Test NestJS module imports
  console.log('\n📋 [Step 4] Testing NestJS module imports...');
  try {
    // Test importing AppModule
    const { AppModule } = require('../src/app.module');
    console.log('✅ [Step 4] AppModule imported successfully');
    
    // Test importing main services
    const { SupabaseAuthService } = require('../src/services/supabase-auth.service');
    const { ChatService } = require('../src/services/chat.service');
    console.log('✅ [Step 4] Core services imported successfully');
  } catch (error: any) {
    console.error('❌ [Step 4] Failed to import modules:', error.message);
    console.error('❌ [Step 4] This indicates a build or module structure issue');
    console.error('❌ [Step 4] Stack:', error.stack);
    process.exit(1);
  }
  
  // Step 5: Try to create NestJS application (this will test all DI and module initialization)
  console.log('\n📋 [Step 5] Testing NestJS application creation (this may take a moment)...');
  try {
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('../src/app.module');
    
    // Try to create the app (this will initialize all modules, services, guards, etc.)
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn'], // Only show errors/warnings
    });
    
    console.log('✅ [Step 5] NestJS application created successfully');
    console.log('✅ [Step 5] All modules, services, and dependencies initialized');
    
    // Close the app
    await app.close();
  } catch (error: any) {
    console.error('❌ [Step 5] Failed to create NestJS application:');
    console.error('❌ [Step 5] Error:', error.message);
    console.error('❌ [Step 5] This is likely the error causing App Runner rollback!');
    console.error('❌ [Step 5] Full error:', error);
    if (error.stack) {
      console.error('❌ [Step 5] Stack trace:');
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

