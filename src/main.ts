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
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Enable CORS
  app.enableCors();

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Allow additional properties
      transform: true,
    }),
  );

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Quotient Advisor Agent API')
    .setDescription(
      'AI-powered agent that understands human quotients and provides personalized advice based on personality analysis'
    )
    .setVersion('1.0')
    .addTag('chat', 'Chat endpoints for interacting with the advisor agent')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 5000;
  await app.listen(port);

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🧠 Quotient Advisor Agent is running!                  ║
║                                                           ║
║   📡 API: http://localhost:${port}                           ║
║   📚 Swagger Docs: http://localhost:${port}/api              ║
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
}

bootstrap();

