import * as dotenv from 'dotenv';
import { join, resolve } from 'path';

// Load .env file before anything else
// In development: dist/src -> backend/.env (../../.env)
// In production: dist/src -> backend/.env (../../.env)
const envPath = resolve(__dirname, '..', '..', '.env');
console.log('📁 [Bootstrap] Looking for .env at:', envPath);
dotenv.config({ path: envPath, override: true });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  try {
    console.log('🚀 [Bootstrap] Starting application...');
    console.log('📋 [Bootstrap] Environment variables check:');
    console.log('   - DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
    console.log('   - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('   - PORT:', process.env.PORT || '3000 (default)');
    
    // Validate critical environment variables
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required but not set');
    }
    
    console.log('📦 [Bootstrap] Creating NestJS application...');
    console.log('📦 [Bootstrap] This may take a moment while modules initialize...');
    console.log('📦 [Bootstrap] Note: If database connection fails, TypeORM will retry...');
    
    let app: NestExpressApplication;
    try {
      app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'], // Enable all log levels for debugging
        abortOnError: false, // Don't abort on errors - let us handle them
      });
      console.log('✅ [Bootstrap] NestJS application created');
      console.log('✅ [Bootstrap] All modules initialized successfully');
    } catch (initError: any) {
      console.error('❌ [Bootstrap] Failed to create NestJS application during module initialization:');
      console.error('❌ [Bootstrap] Error type:', initError?.constructor?.name || typeof initError);
      console.error('❌ [Bootstrap] Error message:', initError?.message || String(initError));
      console.error('❌ [Bootstrap] Error stack:', initError?.stack || 'No stack trace');
      
      // Check if it's a database connection error
      if (initError?.message?.includes('connection') || 
          initError?.message?.includes('ECONNREFUSED') ||
          initError?.message?.includes('timeout') ||
          initError?.message?.includes('database')) {
        console.error('\n💡 [Bootstrap] Database connection error detected during initialization');
        console.error('💡 [Bootstrap] This might be temporary - TypeORM will retry on first use');
        console.error('💡 [Bootstrap] However, if this persists, check:');
        console.error('   1. DATABASE_URL format and credentials');
        console.error('   2. VPC/security group configuration');
        console.error('   3. Database endpoint is reachable from App Runner');
      }
      
      throw initError; // Re-throw to be caught by outer try-catch
    }

    // Serve static files
    console.log('📁 [Bootstrap] Setting up static assets...');
    app.useStaticAssets(join(__dirname, '..', 'public'));

    // Enable CORS - Allow frontend to communicate with backend
    console.log('🌐 [Bootstrap] Configuring CORS...');
    app.enableCors({
      origin: [
        'http://localhost:9001',
        'http://localhost:8000',
        'http://192.168.1.79:8000',
        'http://192.168.1.79:9001',
        'https://main.d3970mma5pzr9g.amplifyapp.com',
        /\.amplifyapp\.com$/, // Allow any Amplify domain
        /\.elasticbeanstalk\.com$/, // Allow Elastic Beanstalk domains
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    });

    // Enable validation
    console.log('✅ [Bootstrap] Setting up validation pipes...');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false, // Allow additional properties
        transform: true,
      }),
    );

    // Setup Swagger documentation
    console.log('📚 [Bootstrap] Setting up Swagger documentation...');
    const config = new DocumentBuilder()
      .setTitle('Quotient Advisor Agent API')
      .setDescription(
        'AI-powered agent that understands human quotients and provides personalized advice based on personality analysis',
      )
      .setVersion('1.0')
      .addTag('chat', 'Chat endpoints for interacting with the advisor agent')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    // Health check endpoint for App Runner (public, no auth required)
    app.getHttpAdapter().get('/health', (req: any, res: any) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // App Runner uses PORT environment variable (usually 8080 or 3000)
    // Default to 3000 to match Dockerfile EXPOSE
    const port = process.env.PORT || 3000;
    console.log(`🌐 [Bootstrap] Starting server on port ${port}...`);
    await app.listen(port, '0.0.0.0'); // Listen on all interfaces for Amplify

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧠 Quotient Advisor Agent is running!                  ║
║                                                           ║
║   📡 API: http://localhost:${port}                           ║
║   📚 Swagger Docs: http://localhost:${port}/api              ║
║   ❤️  Health Check: http://localhost:${port}/health            ║
║                                                           ║
║   Available Quotients:                                    ║
║   • IQ  - Intelligence Quotient                          ║
║   • EQ  - Emotional Quotient                             ║
║   • AQ  - Adversity Quotient                             ║
║   • SQ  - Social Quotient                                ║
║   • CQ  - Creativity Quotient                            ║
║   • MQ  - Moral Quotient                                 ║
║   • LQ  - Learning Quotient                              ║
║   • VQ  - Vision Quotient                                ║
║   • RQ  - Resilience Quotient                            ║
║   • PQ  - Passion Quotient                               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  } catch (error: any) {
    console.error('❌ [Bootstrap] Failed to start application:');
    console.error('❌ [Bootstrap] Error type:', error?.constructor?.name || typeof error);
    console.error('❌ [Bootstrap] Error message:', error?.message || String(error));
    console.error('❌ [Bootstrap] Error stack:', error?.stack || 'No stack trace available');
    
    // Additional debugging information
    console.error('\n🔍 [Bootstrap] Debugging information:');
    console.error('   - Node version:', process.version);
    console.error('   - Platform:', process.platform);
    console.error('   - ARCH:', process.arch);
    console.error('   - NODE_ENV:', process.env.NODE_ENV || 'not set');
    console.error('   - DATABASE_URL:', process.env.DATABASE_URL ? 'Set (length: ' + process.env.DATABASE_URL.length + ')' : 'Missing');
    
    // Check if error is related to database
    if (error?.message?.includes('DATABASE') || error?.message?.includes('database') || error?.message?.includes('connection')) {
      console.error('\n💡 [Bootstrap] Database-related error detected. Check:');
      console.error('   1. DATABASE_URL format: postgresql://user:password@host:port/database');
      console.error('   2. VPC connectivity (if using VPC)');
      console.error('   3. Security group rules (port 5432)');
      console.error('   4. Database endpoint is correct');
    }
    
    process.exit(1);
  }
}

bootstrap().catch((error: any) => {
  console.error('❌ [Bootstrap] Unhandled error in bootstrap:');
  console.error('❌ [Bootstrap] Error:', error?.message || String(error));
  console.error('❌ [Bootstrap] Stack:', error?.stack || 'No stack trace');
  process.exit(1);
});
