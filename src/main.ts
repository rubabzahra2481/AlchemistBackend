import * as dotenv from 'dotenv';
import { join, resolve } from 'path';

// Load .env from backend folder (works whether run from backend/ or project root)
const backendEnv = resolve(__dirname, '..', '..', '.env');
const cwdEnv = join(process.cwd(), '.env');
dotenv.config({ path: cwdEnv });
dotenv.config({ path: backendEnv, override: true });
console.log('📁 [Bootstrap] .env loaded (cwd:', process.cwd(), ')');

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  try {
    console.log('🚀 [Bootstrap] Starting application...');
    console.log('📋 [Bootstrap] Environment variables check:');
    console.log('   - OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('   - IOS_BACKEND_URL:', process.env.IOS_BACKEND_URL ? '✅ Set' : '❌ Missing');
    console.log('   - USE_IOS_BACKEND:', process.env.USE_IOS_BACKEND || 'not set');
    console.log('   - PORT:', process.env.PORT || '3000 (default)');
    console.log('   - TIER_OVERRIDE:', process.env.TIER_OVERRIDE || '(not set — tier from API)');
    
    // Validate critical environment variables
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ [Bootstrap] OPENAI_API_KEY not set - LLM calls will fail');
    }
    
    console.log('📦 [Bootstrap] Creating NestJS application...');
    console.log('📦 [Bootstrap] Note: This backend is STATELESS - all data stored in Munawar\'s backend');
    
    let app: NestExpressApplication;
    try {
      app = await NestFactory.create<NestExpressApplication>(AppModule, {
        logger: ['error', 'warn', 'log'],
        abortOnError: false,
      });
      console.log('✅ [Bootstrap] NestJS application created');
      console.log('✅ [Bootstrap] All modules initialized successfully');
    } catch (initError: any) {
      console.error('❌ [Bootstrap] Failed to create NestJS application:', initError?.message);
      throw initError;
    }

    // Serve static files
    console.log('📁 [Bootstrap] Setting up static assets...');
    app.useStaticAssets(join(__dirname, '..', 'public'));

    // Enable CORS - Allow frontend to communicate with backend
    console.log('🌐 [Bootstrap] Configuring CORS...');
    app.enableCors({
      origin: [
        'http://localhost:9001',
        'http://localhost:8001',
        'http://127.0.0.1:8001',
        'http://localhost:8000',
        'http://127.0.0.1:8000',
        'http://127.0.0.1:3000',
        'http://localhost:3000',
        'http://localhost:9000',
        'http://127.0.0.1:9000',
        'http://192.168.1.79:8000',
        'http://192.168.1.79:9001',
        'https://main.d3970mma5pzr9g.amplifyapp.com',
        /\.amplifyapp\.com$/,
        /\.elasticbeanstalk\.com$/,
        /\.ngrok-free\.app$/,
        /\.ngrok\.io$/,
        /\.awsapprunner\.com$/,
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
    });

    // Enable validation
    console.log('✅ [Bootstrap] Setting up validation pipes...');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
      }),
    );

    // Setup Swagger documentation
    console.log('📚 [Bootstrap] Setting up Swagger documentation...');
    const config = new DocumentBuilder()
      .setTitle('Decision Intelligence Expert API')
      .setDescription('AI-powered agent with E-DNA personality analysis and psychological frameworks')
      .setVersion('1.0')
      .addTag('chat', 'Chat endpoints for interacting with the advisor agent')
      .addTag('faq-chat', 'Standalone FAQ chatbot (not the DI agent)')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    // Health check endpoint
    app.getHttpAdapter().get('/health', (req: any, res: any) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    const port = process.env.PORT || 3000;
    console.log(`🌐 [Bootstrap] Starting server on port ${port}...`);
    await app.listen(port, '0.0.0.0');

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧪 Decision Intelligence Expert is running!                         ║
║                                                           ║
║   📡 API: http://localhost:${port}                           ║
║   📚 Swagger Docs: http://localhost:${port}/api              ║
║   ❤️  Health Check: http://localhost:${port}/health            ║
║                                                           ║
║   🔗 Using Munawar's Backend for data storage            ║
║   🧬 E-DNA profiles enabled                               ║
║   🧠 Psychological frameworks: 11 active                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  } catch (error: any) {
    console.error('❌ [Bootstrap] Failed to start application:', error?.message);
    console.error('❌ [Bootstrap] Stack:', error?.stack);
    process.exit(1);
  }
}

bootstrap().catch((error: any) => {
  console.error('❌ [Bootstrap] Unhandled error:', error?.message);
  process.exit(1);
});
