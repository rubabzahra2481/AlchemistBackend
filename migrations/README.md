# Database Migrations

This directory contains TypeORM migrations for the chat history database.

## Running Migrations

### Run all pending migrations:
```bash
npm run migration:run
```

### Revert the last migration:
```bash
npm run migration:revert
```

### Generate a new migration:
```bash
npm run migration:generate migrations/YourMigrationName
```

## Migration Files

- `1734985600000-CreateChatTables.ts` - Creates the `chat_sessions` and `chat_messages` tables

## Environment Variables Required

Make sure your `.env` file has:
```
DATABASE_URL=postgresql://user:password@host:port/database
```

For Aurora Postgres RDS, the format is typically:
```
DATABASE_URL=postgresql://username:password@your-cluster-endpoint.region.rds.amazonaws.com:5432/database_name
```

## First Time Setup

1. Ensure your Aurora Postgres database is accessible
2. Run the migration to create tables:
   ```bash
   npm run migration:run
   ```

This will create:
- `chat_sessions` table - Stores chat session metadata
- `chat_messages` table - Stores individual messages with metadata

## Notes

- **Never use `synchronize: true` in production** - Always use migrations
- Migrations are run automatically when the app starts (if configured)
- Always backup your database before running migrations in production






