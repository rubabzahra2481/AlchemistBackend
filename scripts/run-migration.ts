import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { ChatSession } from '../src/entities/chat-session.entity';
import { ChatMessage } from '../src/entities/chat-message.entity';

// Load environment variables
config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  process.exit(1);
}

// Parse DATABASE_URL (format: postgresql://user:password@host:port/database)
const url = new URL(databaseUrl);

const AppDataSource = new DataSource({
  type: 'postgres',
  host: url.hostname,
  port: parseInt(url.port, 10) || 5432,
  username: url.username,
  password: url.password,
  database: url.pathname.slice(1), // Remove leading '/'
  entities: [ChatSession, ChatMessage],
  migrations: [join(__dirname, '../migrations/**/*.ts')],
  synchronize: false,
  ssl: {
    rejectUnauthorized: false, // For Aurora Postgres RDS
  },
  logging: process.env.NODE_ENV === 'development',
});

const command = process.argv[2];

AppDataSource.initialize()
  .then(async () => {
    console.log('✅ Database connection established');

    try {
      switch (command) {
        case 'run':
          console.log('🔄 Running migrations...');
          const migrations = await AppDataSource.runMigrations();
          if (migrations.length === 0) {
            console.log('✅ No pending migrations');
          } else {
            console.log(`✅ Ran ${migrations.length} migration(s):`);
            migrations.forEach((migration) => {
              console.log(`   - ${migration.name}`);
            });
          }
          break;

        case 'revert':
          console.log('⏪ Reverting last migration...');
          await AppDataSource.undoLastMigration();
          console.log('✅ Last migration reverted');
          break;

        case 'show':
          console.log('📋 Checking migration status...');
          const hasPendingMigrations = await AppDataSource.showMigrations();
          if (!hasPendingMigrations) {
            console.log('✅ All migrations are up to date');
          } else {
            console.log('⚠️  There are pending migrations');
            const allMigrations = await AppDataSource.migrations;
            console.log(`📊 Total migrations: ${allMigrations.length}`);
            allMigrations.forEach((migration) => {
              console.log(`   - ${migration.name}`);
            });
          }
          break;

        default:
          console.error('❌ Unknown command. Use: run, revert, or show');
          process.exit(1);
      }
    } catch (error) {
      console.error('❌ Migration error:', error);
      process.exit(1);
    } finally {
      await AppDataSource.destroy();
    }
  })
  .catch((error) => {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  });

