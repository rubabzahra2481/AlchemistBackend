import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatSession } from '../entities/chat-session.entity';
import { ChatMessage } from '../entities/chat-message.entity';
// Note: UserSubscription, TokenUsageLog, PremiumReplyUsage tables don't exist yet
// Credit/subscription system is mocked - no database tables needed

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        let databaseUrl: string | undefined;
        try {
          console.log('🗄️ [DatabaseModule] Initializing database connection...');
          databaseUrl = configService.get<string>('DATABASE_URL');
          
          if (!databaseUrl) {
            console.error('❌ [DatabaseModule] DATABASE_URL is not set in environment variables');
            throw new Error('DATABASE_URL is not set in environment variables');
          }

          console.log('✅ [DatabaseModule] DATABASE_URL found');
          // Parse DATABASE_URL (format: postgresql://user:password@host:port/database)
          const url = new URL(databaseUrl);
          const databaseName = url.pathname.slice(1); // Remove leading '/'
          
          console.log('🗄️ [DatabaseModule] Connecting to database:', databaseName);
          console.log('🗄️ [DatabaseModule] Host:', url.hostname);
          console.log('🗄️ [DatabaseModule] Port:', parseInt(url.port, 10) || 5432);
          
          // Disable SSL for local development (localhost)
          const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
          const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };
          console.log('🗄️ [DatabaseModule] SSL:', isLocalhost ? 'disabled (localhost)' : 'enabled');
          
          const config = {
            type: 'postgres' as const,
            host: url.hostname,
            port: parseInt(url.port, 10) || 5432,
            username: url.username,
            password: url.password,
            database: databaseName,
            entities: [ChatSession, ChatMessage],
            synchronize: true, // Enable for local development to auto-create tables
            ssl: sslConfig,
            logging: configService.get<string>('NODE_ENV') === 'development',
            // Connection pool settings (pg driver options)
            extra: {
              max: 10, // Max pool size
              connectionTimeoutMillis: 30000, // Timeout for getting connection from pool (30 seconds)
              idleTimeoutMillis: 30000, // Timeout for idle connections (30 seconds)
            },
            // Retry connection on failure (TypeORM will retry during NestFactory.create())
            retryAttempts: 5, // Increased retries
            retryDelay: 5000, // 5 seconds between retries
            // Auto-load entities (TypeORM will load them automatically)
            autoLoadEntities: false, // We're explicitly providing entities
            // Connection timeout
            connectTimeoutMS: 30000, // 30 seconds connection timeout
          };

          console.log('✅ [DatabaseModule] Database configuration created successfully');
          return config;
        } catch (error: any) {
          console.error('❌ [DatabaseModule] Failed to configure database:');
          console.error('❌ [DatabaseModule] Error message:', error?.message || String(error));
          console.error('❌ [DatabaseModule] Error stack:', error?.stack);
          console.error('❌ [DatabaseModule] DATABASE_URL format:', databaseUrl ? 'Present' : 'Missing');
          if (databaseUrl) {
            try {
              const testUrl = new URL(databaseUrl);
              console.error('❌ [DatabaseModule] DATABASE_URL components:');
              console.error('   - Protocol:', testUrl.protocol);
              console.error('   - Hostname:', testUrl.hostname);
              console.error('   - Port:', testUrl.port || 'default (5432)');
              console.error('   - Username:', testUrl.username ? 'Set' : 'Missing');
              console.error('   - Password:', testUrl.password ? 'Set' : 'Missing');
              console.error('   - Database:', testUrl.pathname || 'Missing');
            } catch (urlError) {
              console.error('❌ [DatabaseModule] DATABASE_URL is not a valid URL');
            }
          }
          throw error;
        }
      },
      inject: [ConfigService],
    }),
    // Register repositories for dependency injection
    TypeOrmModule.forFeature([ChatSession, ChatMessage]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}


