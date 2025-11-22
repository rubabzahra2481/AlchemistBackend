import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatSession } from '../entities/chat-session.entity';
import { ChatMessage } from '../entities/chat-message.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        try {
          console.log('🗄️ [DatabaseModule] Initializing database connection...');
          const databaseUrl = configService.get<string>('DATABASE_URL');
          
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
          
          return {
            type: 'postgres',
            host: url.hostname,
            port: parseInt(url.port, 10) || 5432,
            username: url.username,
            password: url.password,
            database: databaseName,
            entities: [ChatSession, ChatMessage],
            synchronize: false, // ✅ NEVER use synchronize in production - use migrations instead
            ssl: {
              rejectUnauthorized: false, // For Aurora Postgres RDS
            },
            logging: configService.get<string>('NODE_ENV') === 'development',
          };
        } catch (error) {
          console.error('❌ [DatabaseModule] Failed to configure database:', error);
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


