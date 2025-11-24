import { Client } from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(databaseUrl);
const databaseName = url.pathname.slice(1); // Remove leading '/'

// Create a connection URL to the default 'postgres' database
const postgresUrl = databaseUrl.replace(`/${databaseName}`, '/postgres');

const client = new Client({
  connectionString: postgresUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function createDatabase() {
  try {
    console.log(`🔌 Connecting to PostgreSQL...`);
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Check if database exists
    const checkDbQuery = `
      SELECT 1 FROM pg_database WHERE datname = $1
    `;
    const dbExists = await client.query(checkDbQuery, [databaseName]);

    if (dbExists.rows.length > 0) {
      console.log(`✅ Database '${databaseName}' already exists`);
    } else {
      console.log(`📦 Creating database '${databaseName}'...`);
      
      // Note: PostgreSQL doesn't allow creating database in a transaction
      // So we need to use CREATE DATABASE directly
      await client.query(`CREATE DATABASE ${databaseName}`);
      console.log(`✅ Database '${databaseName}' created successfully!`);
    }

    await client.end();
    console.log('\n🎉 Ready to run migrations! Run: npm run migration:run');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    
    if (error.code === '3D000') {
      console.error(`\n💡 Tip: Make sure the database server is running and accessible.`);
      console.error(`   Connection string: ${url.hostname}:${url.port || 5432}`);
    }
    
    process.exit(1);
  }
}

createDatabase();






