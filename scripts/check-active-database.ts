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
const currentDbName = url.pathname.slice(1) || 'postgres';

// Connect to the default 'postgres' database to list all databases
const postgresUrl = databaseUrl.replace(`/${currentDbName}`, '/postgres');

async function checkDatabase(databaseName: string): Promise<{
  name: string;
  tableCount: number;
  tables: string[];
  size: string;
}> {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  
  const currentDbName = new URL(databaseUrl).pathname.slice(1) || 'postgres';
  const dbUrl = databaseUrl.replace(`/${currentDbName}`, `/${databaseName}`);
  
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();

    // Get table count (excluding system tables)
    const tableResult = await client.query(`
      SELECT 
        tablename AS table_name,
        pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE '_prisma%'
      ORDER BY tablename
    `);

    // Get database size
    const sizeResult = await client.query(`
      SELECT pg_size_pretty(pg_database_size($1)) AS size
    `, [databaseName]);

    await client.end();

    return {
      name: databaseName,
      tableCount: tableResult.rows.length,
      tables: tableResult.rows.map((row) => row.table_name),
      size: sizeResult.rows[0].size,
    };
  } catch (error: any) {
    try {
      await client.end();
    } catch (e) {
      // Ignore close errors
    }
    console.error(`   ⚠️  Error checking ${databaseName}: ${error.message}`);
    return {
      name: databaseName,
      tableCount: 0,
      tables: [],
      size: 'N/A',
    };
  }
}

async function checkActiveDatabase() {
  const client = new Client({
    connectionString: postgresUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('🔌 Connecting to Aurora Postgres...\n');
    await client.connect();

    // List all databases (excluding system databases)
    const result = await client.query(`
      SELECT 
        datname AS database_name,
        pg_size_pretty(pg_database_size(datname)) AS size
      FROM pg_database
      WHERE datistemplate = false
        AND datname NOT IN ('rdsadmin')
      ORDER BY datname
    `);

    await client.end();

    if (result.rows.length === 0) {
      console.log('❌ No databases found');
      return;
    }

    console.log('📊 Checking all databases for user-created tables...\n');
    console.log('⏳ This may take a moment...\n');

    // Check each database
    const databaseInfo = await Promise.all(
      result.rows.map((row) => checkDatabase(row.database_name))
    );

    // Sort by table count (most used first)
    databaseInfo.sort((a, b) => b.tableCount - a.tableCount);

    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log('📋 DATABASE USAGE SUMMARY\n');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    databaseInfo.forEach((db, index) => {
      const isMostUsed = index === 0 && db.tableCount > 0;
      const marker = isMostUsed ? ' 👈 MOST USED (Active Database)' : '';
      const status = db.tableCount === 0 ? '  (Empty)' : '';
      
      console.log(`📁 ${db.name.toUpperCase()}${marker}${status}`);
      console.log(`   Total Size: ${db.size}`);
      console.log(`   User Tables: ${db.tableCount}`);
      
      if (db.tableCount > 0) {
        console.log(`   Tables:`);
        // Show first 10 tables, then indicate if there are more
        const tablesToShow = db.tables.slice(0, 10);
        tablesToShow.forEach((table) => {
          console.log(`      • ${table}`);
        });
        if (db.tables.length > 10) {
          console.log(`      ... and ${db.tables.length - 10} more`);
        }
      }
      console.log('');
    });

    console.log('═══════════════════════════════════════════════════════════════════\n');

    // Determine the active database
    const mostUsedDb = databaseInfo[0];
    
    if (mostUsedDb.tableCount === 0) {
      console.log('⚠️  No databases have user-created tables yet.\n');
    } else {
      console.log(`✅ ACTIVE DATABASE: "${mostUsedDb.name}"\n`);
      console.log(`   This database has ${mostUsedDb.tableCount} user-created table(s).`);
      console.log(`   This is likely where the Brandscaling developer created their tables.\n`);

      // Check if DATABASE_URL matches
      const currentDb = url.pathname.slice(1) || 'postgres';
      if (currentDb === mostUsedDb.name) {
        console.log('✅ Your DATABASE_URL is correctly pointing to the active database!\n');
      } else {
        console.log(`⚠️  Your DATABASE_URL points to: "${currentDb}"`);
        console.log(`💡 Consider updating to: "${mostUsedDb.name}"\n`);
      }

      // Show table types/categories
      const tables = mostUsedDb.tables;
      const categories: { [key: string]: string[] } = {};
      
      tables.forEach((table) => {
        // Try to categorize tables
        if (table.includes('user')) {
          categories['User Management'] = categories['User Management'] || [];
          categories['User Management'].push(table);
        } else if (table.includes('post') || table.includes('blog')) {
          categories['Content/Posts'] = categories['Content/Posts'] || [];
          categories['Content/Posts'].push(table);
        } else if (table.includes('course') || table.includes('lesson') || table.includes('lms')) {
          categories['Learning Management'] = categories['Learning Management'] || [];
          categories['Learning Management'].push(table);
        } else if (table.includes('payment') || table.includes('stripe')) {
          categories['Payments'] = categories['Payments'] || [];
          categories['Payments'].push(table);
        } else if (table.includes('workbook') || table.includes('workflow')) {
          categories['Workbooks/Workflows'] = categories['Workbooks/Workflows'] || [];
          categories['Workbooks/Workflows'].push(table);
        } else if (table.includes('email') || table.includes('campaign')) {
          categories['Email/Campaigns'] = categories['Email/Campaigns'] || [];
          categories['Email/Campaigns'].push(table);
        } else if (table.includes('event') || table.includes('lead')) {
          categories['Events/Leads'] = categories['Events/Leads'] || [];
          categories['Events/Leads'].push(table);
        } else if (table.includes('ai_')) {
          categories['AI Features'] = categories['AI Features'] || [];
          categories['AI Features'].push(table);
        } else if (table.includes('chat_')) {
          categories['Chat History'] = categories['Chat History'] || [];
          categories['Chat History'].push(table);
        } else {
          categories['Other'] = categories['Other'] || [];
          categories['Other'].push(table);
        }
      });

      if (Object.keys(categories).length > 0) {
        console.log('📊 Table Categories:\n');
        Object.entries(categories).forEach(([category, tableList]) => {
          console.log(`   ${category}: ${tableList.length} table(s)`);
          if (tableList.length <= 5) {
            tableList.forEach((table) => console.log(`      • ${table}`));
          } else {
            tableList.slice(0, 3).forEach((table) => console.log(`      • ${table}`));
            console.log(`      ... and ${tableList.length - 3} more`);
          }
        });
        console.log('');
      }
    }

    console.log('✅ Database analysis completed!\n');
  } catch (error: any) {
    console.error('❌ Error checking databases:\n');
    console.error('Error:', error.message);

    if (error.code === '28P01') {
      console.error('\n💡 Authentication failed. Check your username and password.\n');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      console.error('\n💡 Connection timeout. Check your endpoint URL and security groups.\n');
    }

    process.exit(1);
  }
}

checkActiveDatabase();

