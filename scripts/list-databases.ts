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
const databaseName = url.pathname.slice(1) || 'postgres';

// Connect to the default 'postgres' database to list all databases
const postgresUrl = databaseUrl.replace(`/${databaseName}`, '/postgres');

const client = new Client({
  connectionString: postgresUrl,
  ssl: {
    rejectUnauthorized: false, // For Aurora Postgres RDS
  },
});

async function listDatabases() {
  try {
    console.log('🔌 Connecting to Aurora Postgres...\n');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // List all databases
    const result = await client.query(`
      SELECT 
        datname AS database_name,
        pg_size_pretty(pg_database_size(datname)) AS size,
        datcollate AS collation,
        datctype AS ctype
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `);

    if (result.rows.length === 0) {
      console.log('❌ No databases found');
    } else {
      console.log(`📊 Found ${result.rows.length} database(s):\n`);
      console.log('┌─────────────────────────────────────┬──────────┬──────────────────┐');
      console.log('│ Database Name                       │ Size     │ Collation        │');
      console.log('├─────────────────────────────────────┼──────────┼──────────────────┤');
      
      result.rows.forEach((row) => {
        const dbName = row.database_name.padEnd(35);
        const size = row.size.padEnd(8);
        const collation = row.collation.padEnd(16);
        
        // Highlight the current database
        const marker = row.database_name === databaseName ? ' ← (current)' : '';
        console.log(`│ ${dbName} │ ${size} │ ${collation} │${marker}`);
      });
      
      console.log('└─────────────────────────────────────┴──────────┴──────────────────┘\n');
      
      // Check if brandscaling_db exists
      const brandscalingDbExists = result.rows.some((row) => row.database_name === 'brandscaling_db');
      const postgresDbExists = result.rows.some((row) => row.database_name === 'postgres');
      
      if (databaseName === 'brandscaling_db' && !brandscalingDbExists) {
        console.log('⚠️  Database "brandscaling_db" does not exist!\n');
        console.log('💡 Create it with:');
        console.log('   npm run db:create\n');
      } else if (databaseName === 'brandscaling_db' && brandscalingDbExists) {
        console.log('✅ Database "brandscaling_db" exists and is ready for migrations!\n');
      }
      
      if (!postgresDbExists) {
        console.log('⚠️  Default "postgres" database not found (unusual)\n');
      }
    }

    // Get connection info
    const infoResult = await client.query('SELECT version(), current_database(), current_user');
    console.log('📋 Connection Info:');
    console.log(`   Server: ${infoResult.rows[0].version.split(',')[0]}`);
    console.log(`   Connected to: ${infoResult.rows[0].current_database}`);
    console.log(`   User: ${infoResult.rows[0].current_user}\n`);

    await client.end();
    console.log('✅ Database listing completed!');
  } catch (error: any) {
    console.error('❌ Error listing databases:\n');
    console.error('Error:', error.message);

    if (error.code === '3D000') {
      console.error('\n💡 Cannot connect to "postgres" database. Trying to connect to specified database...\n');
      
      // Try connecting to the specified database instead
      const fallbackClient = new Client({
        connectionString: databaseUrl,
        ssl: {
          rejectUnauthorized: false,
        },
      });

      try {
        await fallbackClient.connect();
        console.log('✅ Connected to specified database:', databaseName);
        
        // Can't list all databases from a non-postgres connection, but we can verify this one exists
        const infoResult = await fallbackClient.query('SELECT version(), current_database(), current_user');
        console.log('\n📋 Database Info:');
        console.log(`   Database: ${infoResult.rows[0].current_database}`);
        console.log(`   User: ${infoResult.rows[0].current_user}`);
        console.log(`   Server: ${infoResult.rows[0].version.split(',')[0]}\n`);
        
        await fallbackClient.end();
      } catch (fallbackError: any) {
        console.error('❌ Failed to connect to specified database:', fallbackError.message);
        console.error('\n💡 Check:');
        console.error('   - Database name is correct in DATABASE_URL');
        console.error('   - Database exists (create it with: npm run db:create)');
        console.error('   - Username and password are correct');
        process.exit(1);
      }
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
    }

    process.exit(1);
  }
}

listDatabases();






