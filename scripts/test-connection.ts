import { Client } from 'pg';
import { config } from 'dotenv';

// Load environment variables
config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL is not set in environment variables');
  console.log('\n💡 Set it in your .env file:');
  console.log('   DATABASE_URL=postgresql://username:password@endpoint:5432/database_name');
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(databaseUrl);

console.log('🔍 Testing database connection...\n');
console.log(`   Host: ${url.hostname}`);
console.log(`   Port: ${url.port || '5432'}`);
console.log(`   Username: ${url.username}`);
console.log(`   Database: ${url.pathname.slice(1) || 'postgres'}\n`);

const client = new Client({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false, // For Aurora Postgres RDS
  },
});

async function testConnection() {
  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Successfully connected to database!\n');

    // Test query
    const result = await client.query('SELECT version(), current_database(), current_user');
    console.log('📊 Database Info:');
    console.log(`   Version: ${result.rows[0].version.split(',')[0]}`);
    console.log(`   Database: ${result.rows[0].current_database}`);
    console.log(`   User: ${result.rows[0].current_user}\n`);

    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    if (tablesResult.rows.length === 0) {
      console.log('📋 No tables found yet. Run migrations to create them:');
      console.log('   npm run migration:run\n');
    } else {
      console.log(`📋 Found ${tablesResult.rows.length} table(s):`);
      tablesResult.rows.forEach((row) => {
        console.log(`   - ${row.table_name}`);
      });
      console.log('');
    }

    await client.end();
    console.log('✅ Connection test completed successfully!');
  } catch (error: any) {
    console.error('❌ Connection failed!\n');
    console.error('Error:', error.message);

    if (error.code === '3D000') {
      console.error('\n💡 Database does not exist. Options:');
      console.error('   1. Create it manually in AWS RDS Query Editor');
      console.error('   2. Use: npm run db:create');
      console.error(`   3. Or use the default 'postgres' database\n`);
    } else if (error.code === '28P01') {
      console.error('\n💡 Authentication failed. Check:');
      console.error('   - Username is correct');
      console.error('   - Password is correct');
      console.error('   - Master password hasn\'t been changed\n');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      console.error('\n💡 Connection timeout. Check:');
      console.error('   - Endpoint URL is correct');
      console.error('   - Your IP is whitelisted in RDS security group');
      console.error('   - VPC/Network settings allow connection\n');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection refused. Check:');
      console.error('   - Port number is correct (usually 5432)');
      console.error('   - Security group allows inbound on port 5432');
      console.error('   - Database is in "Available" status\n');
    }

    process.exit(1);
  }
}

testConnection();






