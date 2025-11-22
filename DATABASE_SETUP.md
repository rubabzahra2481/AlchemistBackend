# AWS Aurora Postgres Database Setup

## 📖 Related Guides

- **AWS Console Guide**: See `AWS_CONSOLE_GUIDE.md` for step-by-step instructions on viewing databases in AWS UI
- **Database Scripts**: Use `npm run db:*` commands (see package.json scripts)

## Finding Your Database URL in AWS

### Step 1: Access AWS RDS Console

1. Log in to your AWS Console
2. Navigate to **RDS** service (search for "RDS" in the top search bar)
3. Click on **Databases** in the left sidebar

### Step 2: Find Your Aurora Cluster

1. Look for your Aurora cluster (should be named `brandscaling-aurora` based on your `.env`)
2. Click on the cluster name to view details

### Step 3: Get the Connection Endpoint

You'll see several endpoints:
- **Writer endpoint** (use this for applications): `brandscaling-aurora.cluster-xxxxx.region.rds.amazonaws.com`
- **Reader endpoint** (for read replicas)
- **Instance endpoints** (for direct instance connections)

**For your `DATABASE_URL`, use the Writer endpoint.**

### Step 4: Get Database Credentials

1. In the cluster details, look for:
   - **Master username** (e.g., `admin_bs`)
   - **Master password** (set during cluster creation - you may need to reset it if forgotten)

### Step 5: Construct the DATABASE_URL

Format:
```
postgresql://[username]:[password]@[endpoint]:[port]/[database_name]
```

Example:
```
postgresql://admin_bs:YourPassword123@brandscaling-aurora.cluster-cc1k8qu4cwi2.us-east-1.rds.amazonaws.com:5432/brandscaling_db
```

**Components:**
- **Username**: Master username from RDS
- **Password**: Master password
- **Endpoint**: Writer endpoint (cluster endpoint)
- **Port**: Usually `5432` for PostgreSQL
- **Database**: The database name (e.g., `brandscaling_db` or `postgres`)

### Step 6: Create the Database (if it doesn't exist)

The database `brandscaling_db` needs to exist. You can:

**Option A: Use AWS RDS Query Editor**
1. Go to RDS Console → **Query Editor**
2. Connect to your Aurora cluster
3. Run:
   ```sql
   CREATE DATABASE brandscaling_db;
   ```

**Option B: Use psql client**
```bash
psql -h brandscaling-aurora.cluster-xxxxx.region.rds.amazonaws.com -U admin_bs -d postgres
# Then run: CREATE DATABASE brandscaling_db;
```

**Option C: Use our script**
```bash
npm run db:create
```

### Step 7: Update Your .env File

Create/update `backend/.env`:
```env
DATABASE_URL=postgresql://admin_bs:YourPassword123@brandscaling-aurora.cluster-cc1k8qu4cwi2.us-east-1.rds.amazonaws.com:5432/brandscaling_db
```

### Security Considerations

⚠️ **Important Security Notes:**

1. **VPC & Security Groups**:
   - Your Aurora cluster must be in a VPC
   - Your application server (or your local IP) must have access through security groups
   - Add your IP/EC2 security group to the RDS security group inbound rules on port 5432

2. **SSL/TLS**:
   - Aurora Postgres requires SSL connections
   - Our code already handles this with `ssl: { rejectUnauthorized: false }`

3. **Network Access**:
   - If running locally, ensure your IP is whitelisted in the RDS security group
   - If deploying to AWS (EC2, ECS, Lambda), ensure the service is in the same VPC or has VPC peering

### Troubleshooting Connection Issues

**Error: "database does not exist"**
```bash
npm run db:create  # Creates the database if it doesn't exist
```

**Error: "connection timeout" or "ECONNREFUSED"**
- Check security group inbound rules allow your IP on port 5432
- Verify the endpoint URL is correct
- Check if Aurora cluster is in "available" status

**Error: "password authentication failed"**
- Verify username and password are correct
- You may need to reset the master password in RDS Console

**Error: "SSL required"**
- Ensure `ssl: { rejectUnauthorized: false }` is in your database config (already set)

### Quick Reference: Where to Find Each Component

| Component | Location in AWS Console |
|-----------|------------------------|
| **Endpoint** | RDS → Databases → Your Cluster → Connectivity & security → Endpoint |
| **Port** | Usually 5432 (shown next to endpoint) |
| **Username** | RDS → Databases → Your Cluster → Configuration → Master username |
| **Password** | Set during creation (reset in: RDS → Databases → Your Cluster → Modify → Master password) |
| **Database Name** | You need to create it (see Step 6 above) |

### Testing the Connection

Once your `.env` is set up:
```bash
npm run migration:run
```

If successful, you should see:
```
✅ Database connection established
🔄 Running migrations...
✅ Ran 1 migration(s):
   - CreateChatTables1734985600000
```

