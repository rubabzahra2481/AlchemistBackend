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
const dbNameToCheck = process.argv[2] || 'postgres'; // Default to postgres if not specified

// Connect to the specified database
const dbUrl = databaseUrl.replace(`/${url.pathname.slice(1)}`, `/${dbNameToCheck}`);

const client = new Client({
  connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false, // For Aurora Postgres RDS
  },
});

async function listTablesInDatabase() {
  try {
    console.log(`🔌 Connecting to database: "${dbNameToCheck}"...\n`);
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // List all tables with details
    const result = await client.query(`
      SELECT 
        t.tablename AS table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(t.schemaname) || '.' || quote_ident(t.tablename))) AS size,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.tablename) AS column_count,
        obj_description(c.oid, 'pg_class') AS table_comment
      FROM pg_tables t
      LEFT JOIN pg_class c ON c.relname = t.tablename
      WHERE t.schemaname = 'public'
        AND t.tablename NOT LIKE 'pg_%'
        AND t.tablename NOT LIKE '_prisma%'
      ORDER BY t.tablename
    `);

    // Get database size
    const dbSizeResult = await client.query(`
      SELECT pg_size_pretty(pg_database_size($1)) AS size
    `, [dbNameToCheck]);

    // Get row counts for each table
    const tableInfo = await Promise.all(
      result.rows.map(async (row) => {
        try {
          const countResult = await client.query(`SELECT COUNT(*) as count FROM "${row.table_name}"`);
          return {
            ...row,
            row_count: parseInt(countResult.rows[0].count, 10),
          };
        } catch (error) {
          // If counting fails, table might not be accessible
          return {
            ...row,
            row_count: null,
          };
        }
      })
    );

    if (tableInfo.length === 0) {
      console.log(`📋 No user-created tables found in database "${dbNameToCheck}"\n`);
    } else {
      console.log(`═══════════════════════════════════════════════════════════════════\n`);
      console.log(`📊 TABLES IN DATABASE: "${dbNameToCheck.toUpperCase()}"\n`);
      console.log(`   Total Database Size: ${dbSizeResult.rows[0].size}\n`);
      console.log(`   Total Tables: ${tableInfo.length}\n`);
      console.log(`═══════════════════════════════════════════════════════════════════\n`);

      // Display tables
      tableInfo.forEach((table, index) => {
        console.log(`${index + 1}. 📋 ${table.table_name}`);
        console.log(`   Size: ${table.size || 'N/A'}`);
        console.log(`   Columns: ${table.column_count || 'N/A'}`);
        if (table.row_count !== null) {
          console.log(`   Rows: ${table.row_count.toLocaleString()}`);
        } else {
          console.log(`   Rows: Unable to count`);
        }
        if (table.table_comment) {
          console.log(`   Comment: ${table.table_comment}`);
        }
        console.log('');
      });

      // Summary
      const totalRows = tableInfo.reduce((sum, table) => sum + (table.row_count || 0), 0);
      const tablesWithData = tableInfo.filter((table) => table.row_count && table.row_count > 0).length;
      
      console.log(`═══════════════════════════════════════════════════════════════════\n`);
      console.log(`📈 SUMMARY:\n`);
      console.log(`   Total Tables: ${tableInfo.length}`);
      console.log(`   Tables with Data: ${tablesWithData}`);
      console.log(`   Empty Tables: ${tableInfo.length - tablesWithData}`);
      console.log(`   Total Rows: ${totalRows.toLocaleString()}\n`);

      // Group tables by category/purpose (based on naming patterns)
      const categories: { [key: string]: typeof tableInfo } = {};
      
      tableInfo.forEach((table) => {
        const name = table.table_name.toLowerCase();
        let category = 'Other';
        
        if (name.includes('user') || name.includes('profile')) {
          category = 'User Management';
        } else if (name.includes('post') || name.includes('blog')) {
          category = 'Content/Posts';
        } else if (name.includes('course') || name.includes('lesson') || name.includes('lms')) {
          category = 'Learning Management';
        } else if (name.includes('payment') || name.includes('stripe')) {
          category = 'Payments';
        } else if (name.includes('workbook') || name.includes('workflow')) {
          category = 'Workbooks/Workflows';
        } else if (name.includes('email') || name.includes('campaign')) {
          category = 'Email/Campaigns';
        } else if (name.includes('event') || name.includes('lead')) {
          category = 'Events/Leads';
        } else if (name.includes('ai_') || name.includes('conversation')) {
          category = 'AI Features';
        } else if (name.includes('chat_')) {
          category = 'Chat History';
        } else if (name.includes('quiz') || name.includes('test')) {
          category = 'Quizzes/Tests';
        } else if (name.includes('edna') || name.includes('question') || name.includes('response')) {
          category = 'Questionnaires/Surveys';
        } else if (name.includes('message') || name.includes('conversation')) {
          category = 'Messages/Conversations';
        } else if (name.includes('connection') || name.includes('test')) {
          category = 'Testing/Development';
        }
        
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(table);
      });

      if (Object.keys(categories).length > 1) {
        console.log(`📊 TABLES BY CATEGORY:\n`);
        Object.entries(categories).forEach(([category, tables]) => {
          console.log(`   ${category}: ${tables.length} table(s)`);
          tables.forEach((table) => {
            const rowInfo = table.row_count !== null ? ` (${table.row_count.toLocaleString()} rows)` : '';
            console.log(`      • ${table.table_name}${rowInfo}`);
          });
        });
        console.log('');
      }
    }

    // Get database info
    const infoResult = await client.query('SELECT version(), current_database(), current_user');
    console.log(`📋 Database Info:\n`);
    console.log(`   Server: ${infoResult.rows[0].version.split(',')[0]}`);
    console.log(`   Database: ${infoResult.rows[0].current_database}`);
    console.log(`   User: ${infoResult.rows[0].current_user}\n`);

    await client.end();
    console.log('✅ Table listing completed!\n');
  } catch (error: any) {
    console.error('❌ Error listing tables:\n');
    console.error('Error:', error.message);

    if (error.code === '3D000') {
      console.error(`\n💡 Database "${dbNameToCheck}" does not exist.\n`);
      console.error('💡 Available databases:');
      console.error('   • brandscaling');
      console.error('   • postgres');
      console.error('   • rdsadmin (system)\n');
    } else if (error.code === '28P01') {
      console.error('\n💡 Authentication failed. Check your username and password.\n');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      console.error('\n💡 Connection timeout. Check your endpoint URL and security groups.\n');
    }

    process.exit(1);
  }
}

listTablesInDatabase();






