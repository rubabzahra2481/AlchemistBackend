import * as dotenv from 'dotenv';
import { join } from 'path';

// Load .env file before anything else
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

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
    console.log('   - SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
    console.log('   - SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
    console.log('   - PORT:', process.env.PORT || '5000 (default)');
    
    console.log('📦 [Bootstrap] Creating NestJS application...');
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    console.log('✅ [Bootstrap] NestJS application created');

    // Serve static files
    console.log('📁 [Bootstrap] Setting up static assets...');
    app.useStaticAssets(join(__dirname, '..', 'public'));

    // Enable CORS - Allow frontend to communicate with backend
    console.log('🌐 [Bootstrap] Configuring CORS...');
    app.enableCors({
      origin: [
        'http://localhost:8000',
        'http://192.168.1.79:8000',
        'https://main.d3970mma5pzr9g.amplifyapp.com',
        /\.amplifyapp\.com$/, // Allow any Amplify domain
        /\.elasticbeanstalk\.com$/, // Allow Elastic Beanstalk domains
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
  } catch (error) {
    console.error('❌ [Bootstrap] Failed to start application:');
    console.error('❌ [Bootstrap] Error:', error);
    console.error('❌ [Bootstrap] Stack:', error.stack);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('❌ [Bootstrap] Unhandled error:', error);
  process.exit(1);
});
