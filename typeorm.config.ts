import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { ChatSession } from './src/entities/chat-session.entity';
import { ChatMessage } from './src/entities/chat-message.entity';

// Load environment variables
config();

const configService = new ConfigService();
const databaseUrl = configService.get<string>('DATABASE_URL');

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

// Parse DATABASE_URL (format: postgresql://user:password@host:port/database)
const url = new URL(databaseUrl);

export default new DataSource({
  type: 'postgres',
  host: url.hostname,
  port: parseInt(url.port, 10) || 5432,
  username: url.username,
  password: url.password,
  database: url.pathname.slice(1), // Remove leading '/'
  entities: [ChatSession, ChatMessage],
  migrations: ['migrations/**/*.ts'],
  synchronize: false, // ✅ NEVER use synchronize in production
  ssl: {
    rejectUnauthorized: false, // For Aurora Postgres RDS
  },
  logging: configService.get<string>('NODE_ENV') === 'development',
});

