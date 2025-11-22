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
        const databaseUrl = configService.get<string>('DATABASE_URL');
        
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is not set in environment variables');
        }

        // Parse DATABASE_URL (format: postgresql://user:password@host:port/database)
        const url = new URL(databaseUrl);
        
        return {
          type: 'postgres',
          host: url.hostname,
          port: parseInt(url.port, 10) || 5432,
          username: url.username,
          password: url.password,
          database: url.pathname.slice(1), // Remove leading '/'
          entities: [ChatSession, ChatMessage],
          synchronize: false, // ✅ NEVER use synchronize in production - use migrations instead
          ssl: {
            rejectUnauthorized: false, // For Aurora Postgres RDS
          },
          logging: configService.get<string>('NODE_ENV') === 'development',
        };
      },
      inject: [ConfigService],
    }),
    // Register repositories for dependency injection
    TypeOrmModule.forFeature([ChatSession, ChatMessage]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}


