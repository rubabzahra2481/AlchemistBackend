# TypeORM Connection to Aurora Postgres - Requirements

## 🔍 What TypeORM Needs to Connect to Aurora

TypeORM needs several things to connect to Aurora Postgres:

### 1. **Connection String (DATABASE_URL)** ✅ Required

**Format:**
```
postgresql://username:password@host:port/database
```

**Example:**
```
postgresql://admin_bs:YourPassword@brandscaling-aurora.cluster-cc1k8qu4cwi2.us-east-1.rds.amazonaws.com:5432/postgres
```

**Components:**
- **Protocol:** `postgresql://` (required)
- **Username:** Database master username (e.g., `admin_bs`)
- **Password:** Database master password (e.g., `YourPassword`)
- **Host:** Aurora cluster endpoint (e.g., `brandscaling-aurora.cluster-...`)
- **Port:** PostgreSQL port (usually `5432`)
- **Database:** Database name (e.g., `postgres`)

**In App Runner:**
- Set as environment variable: `DATABASE_URL`
- Format must be exact: `postgresql://user:pass@host:port/db`

---

### 2. **Network Connectivity** ✅ Required

**VPC Configuration:**
- App Runner must be in the **same VPC** as Aurora
- OR App Runner must have **VPC connector** configured
- OR Aurora must be **publicly accessible** (not recommended)

**Security Groups:**
- Aurora security group must allow **inbound traffic on port 5432**
- Source: App Runner security group or VPC CIDR

**Current Status:**
- ✅ You mentioned App Runner and Aurora are in the same VPC
- ⚠️ Need to verify security groups allow traffic

---

### 3. **SSL Configuration** ✅ Required for Aurora

**TypeORM SSL Config:**
```typescript
ssl: {
  rejectUnauthorized: false, // Required for Aurora Postgres
}
```

**Why:**
- Aurora Postgres requires SSL/TLS connections
- `rejectUnauthorized: false` allows self-signed certificates (Aurora uses AWS certificates)

**Current Config:**
- ✅ Already configured in `database.module.ts`

---

### 4. **TypeORM Configuration** ✅ Required

**Required Settings:**
```typescript
{
  type: 'postgres',
  host: 'aurora-cluster-endpoint',
  port: 5432,
  username: 'admin_bs',
  password: 'YourPassword',
  database: 'postgres',
  entities: [ChatSession, ChatMessage],
  synchronize: false, // NEVER true in production
  ssl: {
    rejectUnauthorized: false,
  },
}
```

**Current Config:**
- ✅ All configured in `database.module.ts`
- ✅ Uses `DATABASE_URL` parsing (dynamic)

---

### 5. **Database Credentials** ✅ Required

**What You Need:**
- **Master username** (set during Aurora cluster creation)
- **Master password** (set during Aurora cluster creation)
- **Database name** (e.g., `postgres`)

**Where to Find:**
1. AWS RDS Console → Your Aurora cluster
2. **Configuration** tab → **Credentials & authentication**
3. Master username is shown
4. Password was set during creation (or reset it if needed)

**Important:**
- Username/password must be correct
- Special characters in password must be URL-encoded in DATABASE_URL

---

### 6. **Connection Pool Settings** ⚠️ Optional but Recommended

**Current Config:**
```typescript
extra: {
  max: 10, // Max connections in pool
  connectionTimeoutMillis: 30000, // 30 seconds
  idleTimeoutMillis: 30000, // 30 seconds
}
```

**Retry Settings:**
```typescript
retryAttempts: 5, // Retry connection attempts
retryDelay: 5000, // 5 seconds between retries
```

**Current Status:**
- ✅ Already configured with retry logic

---

## 🔍 What Happens When TypeORM Connects

### During Startup (NestFactory.create):

1. **TypeORM Module Initializes:**
   - Reads `DATABASE_URL` from environment variables
   - Parses the connection string
   - Validates format (must be valid URL)

2. **TypeORM Tries to Connect:**
   - Establishes TCP connection to Aurora endpoint
   - Negotiates SSL/TLS handshake
   - Authenticates with username/password
   - Selects the database

3. **If Connection Succeeds:**
   - TypeORM stores connection in pool
   - NestJS continues startup
   - App starts successfully ✅

4. **If Connection Fails:**
   - TypeORM retries (5 attempts with 5-second delays)
   - If all retries fail → NestJS startup fails
   - App crashes → Exit code 1 ❌

---

## ❌ Common Connection Failures

### Error 1: Invalid DATABASE_URL Format

**Error:**
```
Error: Invalid URL
DATABASE_URL is not a valid URL
```

**Cause:**
- Missing `postgresql://` protocol
- Missing `:5432` port
- Missing `/database` name
- Invalid URL format

**Fix:**
- Use exact format: `postgresql://user:pass@host:port/db`
- URL-encode special characters in password

---

### Error 2: Connection Refused

**Error:**
```
Error: connect ECONNREFUSED
Error: connection refused
```

**Cause:**
- Aurora not reachable from App Runner
- Wrong endpoint/hostname
- Port 5432 blocked by security group
- Aurora not in same VPC

**Fix:**
- Verify VPC configuration
- Check security groups
- Use cluster endpoint (not instance endpoint)
- Verify Aurora is in "Available" status

---

### Error 3: Authentication Failed

**Error:**
```
Error: password authentication failed
Error: authentication failed
```

**Cause:**
- Wrong username
- Wrong password
- Password special characters not URL-encoded

**Fix:**
- Verify credentials in RDS Console
- Reset password if needed
- URL-encode password in DATABASE_URL

---

### Error 4: Database Does Not Exist

**Error:**
```
Error: database "postgres" does not exist
Error: 3D000
```

**Cause:**
- Wrong database name in DATABASE_URL
- Database not created yet

**Fix:**
- Use correct database name (`postgres` is default)
- Or create the database first

---

### Error 5: Connection Timeout

**Error:**
```
Error: timeout
Error: connection timeout
```

**Cause:**
- Network latency
- Security group blocking traffic
- Aurora slow to respond

**Fix:**
- Increase `connectionTimeoutMillis`
- Check VPC/security groups
- Verify Aurora performance

---

## 🔧 How to Test Connection

### Test 1: Verify DATABASE_URL Format

```bash
node -e "const url = new URL(process.env.DATABASE_URL); console.log('Valid:', url.hostname, url.port, url.pathname);"
```

### Test 2: Test Connection Locally

```bash
psql "postgresql://user:pass@host:5432/db"
```

### Test 3: Test from App Runner VPC

If you have access to App Runner instance:
```bash
psql "postgresql://user:pass@host:5432/db"
```

---

## ✅ Current Configuration Status

### What's Configured:

✅ **DATABASE_URL parsing** - Parses connection string correctly  
✅ **SSL configuration** - `rejectUnauthorized: false` for Aurora  
✅ **Connection pool** - Max 10 connections, 30s timeout  
✅ **Retry logic** - 5 attempts, 5s delay  
✅ **Error logging** - Comprehensive error messages  

### What to Verify:

⚠️ **DATABASE_URL format** in App Runner (must be full connection string)  
⚠️ **VPC configuration** - App Runner and Aurora in same VPC  
⚠️ **Security groups** - Allow traffic on port 5432  
⚠️ **Credentials** - Username/password correct  
⚠️ **Database exists** - `postgres` database exists  

---

## 🎯 Summary

**TypeORM needs:**

1. ✅ **DATABASE_URL** (full connection string)
2. ✅ **Network access** (VPC/security groups)
3. ✅ **SSL enabled** (rejectUnauthorized: false)
4. ✅ **Valid credentials** (username/password)
5. ✅ **Database exists** (postgres or your database name)
6. ✅ **TypeORM config** (already set up)

**Most likely issue:**
- DATABASE_URL format is wrong in App Runner
- OR network connectivity issue (VPC/security groups)

**Fix:**
1. Verify DATABASE_URL in App Runner
2. Check security groups allow traffic
3. Verify VPC configuration
4. Test connection from App Runner VPC





