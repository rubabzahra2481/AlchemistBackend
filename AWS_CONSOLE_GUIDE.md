# How to Check Databases on AWS RDS Console

This guide shows you exactly where to find database information in the AWS RDS Console.

## 🎯 Quick Navigation Steps

### Step 1: Access AWS RDS Console

1. **Log in to AWS Console**
   - Go to [https://console.aws.amazon.com](https://console.aws.amazon.com)
   - Sign in with your AWS credentials

2. **Navigate to RDS**
   - In the top search bar, type "RDS"
   - Click on **"RDS"** (Relational Database Service)

### Step 2: View Your Aurora Cluster

1. **Go to Databases**
   - In the left sidebar, click **"Databases"**
   - You'll see your Aurora cluster: `brandscaling-aurora`

2. **Click on the Cluster Name**
   - Click on **`brandscaling-aurora`** to view cluster details

### Step 3: View Database Details

#### A. Cluster Overview
- **Status**: Should show "Available"
- **Engine**: Aurora PostgreSQL
- **Engine version**: (e.g., PostgreSQL 16.8)
- **Created**: Shows creation timestamp ⭐ **This is when the cluster was created!**

#### B. Configuration Tab
- Click on **"Configuration"** tab
- You'll see:
  - **Master username**: `admin_bs`
  - **Master password**: (not shown, but you can modify)
  - **Database name**: (shown if specified during creation)
  - **DB cluster identifier**: `brandscaling-aurora`
  - **Created**: Exact timestamp of cluster creation ⭐

#### C. Connectivity & Security Tab
- Click on **"Connectivity & security"** tab
- You'll see:
  - **Endpoint**: Writer endpoint (for your DATABASE_URL)
  - **Port**: Usually 5432
  - **VPC**: Virtual private cloud ID
  - **VPC security groups**: Security group IDs

#### D. Monitoring Tab
- Click on **"Monitoring"** tab
- View:
  - Database performance metrics
  - CPU utilization
  - Database connections
  - Storage metrics

### Step 4: Access Database Tables (Query Editor)

To actually view the databases and tables:

#### Option A: Using RDS Query Editor (Recommended)

1. **Open Query Editor**
   - In the left sidebar, click **"Query Editor"**
   - Or click **"Query Editor"** button at the top

2. **Connect to Your Database**
   - Select **"brandscaling-aurora"** cluster
   - Choose **"Writer instance"**
   - Select database: **`brandscaling`** or **`postgres`**
   - Enter username: **`admin_bs`**
   - Enter password: Your master password
   - Click **"Connect"**

3. **Query Database Information**

   **List all databases:**
   ```sql
   SELECT 
     datname AS database_name,
     pg_size_pretty(pg_database_size(datname)) AS size,
     datistemplate AS is_template
   FROM pg_database
   WHERE datistemplate = false
   ORDER BY datname;
   ```

   **List tables in a database:**
   ```sql
   SELECT 
     tablename AS table_name,
     pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
   FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename NOT LIKE 'pg_%'
   ORDER BY tablename;
   ```

   **Count tables per database:**
   ```sql
   -- First, connect to each database separately and run:
   SELECT COUNT(*) as table_count
   FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename NOT LIKE 'pg_%';
   ```

#### Option B: Using AWS Systems Manager Session Manager (if enabled)

1. **Connect via Session Manager**
   - RDS Console → Your cluster → **"Connectivity & security"**
   - Click **"Set up EC2 Instance Connect endpoint"** (if available)
   - Connect to database using `psql`

#### Option C: Using pgAdmin or DBeaver (Local Client)

1. **Download Database Client**
   - pgAdmin: [https://www.pgadmin.org/](https://www.pgadmin.org/)
   - DBeaver: [https://dbeaver.io/](https://dbeaver.io/)

2. **Connect with Connection String**
   ```
   Host: brandscaling-aurora.cluster-cc1k8qu4cwi2.us-east-1.rds.amazonaws.com
   Port: 5432
   Database: brandscaling (or postgres)
   Username: admin_bs
   Password: Your master password
   SSL: Required (verify CA or allow all)
   ```

### Step 5: View Database Creation Dates

#### Method 1: Check Cluster Creation Time
1. Go to RDS Console → **Databases** → **brandscaling-aurora**
2. Click **"Configuration"** tab
3. Look for **"Created"** field - shows when cluster was created

#### Method 2: Check via CloudTrail (API Calls)
1. Go to **CloudTrail** service
2. Click **"Event history"**
3. Filter by:
   - **Event name**: `CreateDBCluster` or `CreateDBInstance`
   - **Resource name**: `brandscaling-aurora`
4. View timestamps of when databases were created

#### Method 3: Check via Query Editor
Connect to database and run:
```sql
-- Get database OIDs (lower = created earlier)
SELECT 
  datname AS database_name,
  oid AS database_oid,
  datconnlimit AS connection_limit
FROM pg_database
WHERE datname NOT IN ('template0', 'template1', 'rdsadmin')
ORDER BY oid ASC;
```

### Step 6: View Table Details

1. **Using Query Editor:**
   ```sql
   -- Connect to 'brandscaling' database first
   \c brandscaling

   -- List all tables with row counts
   SELECT 
     t.tablename AS table_name,
     pg_size_pretty(pg_total_relation_size('public.' || t.tablename)) AS size,
     (SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = t.tablename) AS column_count
   FROM pg_tables t
   WHERE t.schemaname = 'public'
     AND t.tablename NOT LIKE 'pg_%'
   ORDER BY t.tablename;
   ```

2. **View specific table structure:**
   ```sql
   \d table_name
   -- Example: \d users
   ```

## 📍 Quick Reference: Where to Find What

| What You Want to Check | Where in AWS Console |
|------------------------|---------------------|
| **Database Cluster Details** | RDS → Databases → brandscaling-aurora |
| **Cluster Creation Date** | RDS → Databases → brandscaling-aurora → Configuration tab → Created |
| **Connection Endpoint** | RDS → Databases → brandscaling-aurora → Connectivity & security → Endpoint |
| **Master Username** | RDS → Databases → brandscaling-aurora → Configuration → Master username |
| **View Tables** | RDS → Query Editor → Connect → Run SQL queries |
| **Database Performance** | RDS → Databases → brandscaling-aurora → Monitoring tab |
| **Security Groups** | RDS → Databases → brandscaling-aurora → Connectivity & security → VPC security groups |
| **Backups** | RDS → Databases → brandscaling-aurora → Automated backups tab |
| **Logs & Events** | RDS → Databases → brandscaling-aurora → Logs & events tab |

## 🔍 Viewing Specific Databases

### Check Which Databases Exist

1. **RDS Query Editor:**
   ```sql
   SELECT datname FROM pg_database 
   WHERE datistemplate = false 
   ORDER BY datname;
   ```
   Result should show:
   - `brandscaling` ✅ (your active database)
   - `postgres` (default database)
   - `rdsadmin` (AWS system database)

### Switch Between Databases in Query Editor

1. After connecting, use:
   ```sql
   \c brandscaling  -- Connect to brandscaling database
   \c postgres      -- Connect to postgres database
   ```

### View Tables in Each Database

**In brandscaling database:**
```sql
\c brandscaling
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;
```

**In postgres database:**
```sql
\c postgres
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename NOT LIKE 'pg_%'
ORDER BY tablename;
```

## 🎯 Common Queries for Database Info

### Database Sizes
```sql
SELECT 
  datname AS database_name,
  pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database
WHERE datistemplate = false
ORDER BY pg_database_size(datname) DESC;
```

### Table Counts per Database
```sql
-- Run this for each database separately
SELECT COUNT(*) as table_count
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%';
```

### Recent Activity (if enabled)
Check **"Logs & events"** tab in RDS Console for:
- Database modifications
- Security events
- Performance issues

## ⚠️ Important Notes

1. **Query Editor**: Requires direct database connection with username/password
2. **Security Groups**: Your IP must be whitelisted in RDS security group to connect
3. **SSL**: Aurora Postgres requires SSL connections
4. **Master Password**: If forgotten, reset via RDS Console → Modify → Master password

## 🆘 Troubleshooting

**Can't connect to Query Editor?**
- Check if your IP is whitelisted in RDS security group
- Verify username and password are correct
- Ensure security group allows inbound on port 5432

**Don't see Query Editor option?**
- Make sure you're in the correct AWS region
- Query Editor may not be available in all regions
- Try using pgAdmin or DBeaver as alternative

**Need exact creation timestamps?**
- Check CloudTrail for `CreateDBCluster` events
- Check RDS Console → Configuration → Created field
- OID order (from our scripts) shows relative creation order


