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
const defaultDatabase = 'postgres'; // Connect to postgres to list all databases

// Connect to the default 'postgres' database to list all databases
const postgresUrl = databaseUrl.replace(`/${url.pathname.slice(1)}`, '/postgres');

const client = new Client({
  connectionString: postgresUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function checkDatabaseCreationDates() {
  try {
    console.log('🔌 Connecting to Aurora Postgres...\n');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Get database creation dates and info
    // Note: PostgreSQL doesn't directly track database creation date,
    // but we can use oid (object identifier) which is assigned chronologically
    // and also check the oldest table/object in each database
    const result = await client.query(`
      SELECT 
        d.datname AS database_name,
        d.oid AS database_oid,
        pg_size_pretty(pg_database_size(d.datname)) AS size,
        d.datcollate AS collation,
        d.datctype AS ctype,
        d.datconnlimit AS connection_limit,
        CASE 
          WHEN d.datistemplate THEN 'Template'
          WHEN d.datname = 'postgres' THEN 'Default'
          WHEN d.datname = 'rdsadmin' THEN 'AWS System'
          ELSE 'User'
        END AS database_type
      FROM pg_database d
      WHERE d.datname NOT IN ('template0', 'template1')
      ORDER BY d.oid ASC
    `);

    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log('📅 DATABASE CREATION TIMELINE\n');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    if (result.rows.length === 0) {
      console.log('❌ No databases found');
      return;
    }

    // Sort by OID (object identifier) - lower OID = created earlier
    const databases = result.rows.sort((a, b) => parseInt(a.database_oid, 10) - parseInt(b.database_oid, 10));

    // For each database, check the oldest object/table
    const databaseDetails = await Promise.all(
      databases.map(async (db) => {
        if (db.database_name === 'rdsadmin') {
          // Skip rdsadmin - it's AWS managed
          return {
            ...db,
            oldest_table: null,
            oldest_table_date: null,
            table_count: 0,
          };
        }

        try {
          if (!databaseUrl) {
            throw new Error('DATABASE_URL is not set');
          }
          const currentDbName = url.pathname.slice(1) || 'postgres';
          const dbUrl = databaseUrl.replace(`/${currentDbName}`, `/${db.database_name}`);
          const dbClient = new Client({
            connectionString: dbUrl,
            ssl: {
              rejectUnauthorized: false,
            },
          });

          await dbClient.connect();

          // Get oldest table (by relfilenode - file node creation order)
          let oldestTableResult;
          try {
            oldestTableResult = await dbClient.query(`
              SELECT 
                tablename AS table_name,
                pg_catalog.pg_get_userbyid(c.relowner) AS owner,
                c.relfilenode AS file_node
              FROM pg_tables t
              JOIN pg_class c ON c.relname = t.tablename
              WHERE t.schemaname = 'public'
                AND t.tablename NOT LIKE 'pg_%'
                AND t.tablename NOT LIKE '_prisma%'
              ORDER BY c.relfilenode ASC
              LIMIT 1
            `);
          } catch (error) {
            oldestTableResult = { rows: [] };
          }

          // Get table count
          const tableCountResult = await dbClient.query(`
            SELECT COUNT(*) as count
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename NOT LIKE 'pg_%'
              AND tablename NOT LIKE '_prisma%'
          `);

          // Get object count and oldest object ID
          const creationInfo = await dbClient.query(`
            SELECT 
              MIN(c.relfilenode) as oldest_object_id,
              COUNT(DISTINCT c.oid) as object_count,
              MAX(c.relfilenode) as newest_object_id
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relkind = 'r'
          `);

          await dbClient.end();

          return {
            ...db,
            oldest_table: oldestTableResult.rows[0]?.table_name || null,
            oldest_table_owner: oldestTableResult.rows[0]?.owner || null,
            oldest_file_node: oldestTableResult.rows[0]?.file_node || null,
            table_count: parseInt(tableCountResult.rows[0]?.count || '0', 10),
            oldest_object_id: creationInfo.rows[0]?.oldest_object_id || null,
            newest_object_id: creationInfo.rows[0]?.newest_object_id || null,
            object_count: creationInfo.rows[0]?.object_count || 0,
          };
        } catch (error: any) {
          return {
            ...db,
            oldest_table: null,
            oldest_table_owner: null,
            oldest_file_node: null,
            table_count: 0,
            oldest_object_id: null,
            newest_object_id: null,
            object_count: 0,
            error: error.message,
          };
        }
      })
    );

    // Display results in chronological order (by OID)
    databaseDetails.forEach((db, index) => {
      const isFirst = index === 0;
      const currentDbName = url.pathname.slice(1) || 'postgres';
      const isActive = db.database_name === currentDbName;
      
      console.log(`${index + 1}. 📁 ${db.database_name.toUpperCase()} ${isFirst ? '(Oldest)' : ''} ${isActive ? '👈 (Current DB)' : ''}`);
      console.log(`   Type: ${db.database_type}`);
      console.log(`   Size: ${db.size}`);
      console.log(`   OID: ${db.database_oid} ${isFirst ? '← Created first (lowest OID)' : ''}`);
      
      if (db.database_name !== 'rdsadmin') {
        console.log(`   User Tables: ${db.table_count}`);
        
        if (db.oldest_table) {
          console.log(`   Oldest Table: ${db.oldest_table} (File Node: ${db.oldest_file_node})`);
          if (db.oldest_table_owner) {
            console.log(`   Table Owner: ${db.oldest_table_owner}`);
          }
        }
        
        if (db.oldest_object_id && db.newest_object_id) {
          console.log(`   Object ID Range: ${db.oldest_object_id} (oldest) → ${db.newest_object_id} (newest)`);
          console.log(`   Total Objects: ${db.object_count}`);
        }
      } else {
        console.log(`   Note: AWS RDS system database (not user-created)`);
      }
      
      if (db.error) {
        console.log(`   ⚠️  Error: ${db.error}`);
      }
      
      console.log('');
    });

    // Determine creation order
    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log('📅 CREATION ORDER ANALYSIS:\n');
    
    const userDatabases = databaseDetails.filter((db) => db.database_type === 'User' || db.database_type === 'Default');
    
    if (userDatabases.length > 0) {
      console.log('Databases created (in order, based on OID):\n');
      userDatabases.forEach((db, index) => {
        console.log(`   ${index + 1}. "${db.database_name}" (OID: ${db.database_oid})`);
        if (db.table_count > 0) {
          console.log(`      → Has ${db.table_count} user-created table(s)`);
          if (db.oldest_table) {
            console.log(`      → Oldest table: ${db.oldest_table} (created first in this DB)`);
          }
        } else {
          console.log(`      → No user-created tables found`);
        }
      });
      console.log('');
      
      const oldestDb = userDatabases[0];
      const newestDb = userDatabases[userDatabases.length - 1];
      
      if (oldestDb && newestDb && oldestDb.database_name !== newestDb.database_name) {
        console.log(`💡 "${oldestDb.database_name}" appears to be the oldest database (lowest OID: ${oldestDb.database_oid})`);
        console.log(`💡 "${newestDb.database_name}" appears to be the newest database (highest OID: ${newestDb.database_oid})\n`);
      }
    }

    // Note about creation dates
    console.log('═══════════════════════════════════════════════════════════════════\n');
    console.log('ℹ️  NOTES:\n');
    console.log('   • PostgreSQL OID (Object Identifier) is assigned chronologically');
    console.log('   • Lower OID = Created earlier in the cluster lifecycle');
    console.log('   • OID reflects the order of creation, not exact timestamps');
    console.log('   • For exact timestamps, check AWS RDS console logs or CloudTrail\n');

    await client.end();
    console.log('✅ Database creation analysis completed!\n');
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

checkDatabaseCreationDates();

