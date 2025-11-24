# Health Check Explained + Startup Failure Analysis

## 🔍 What is Health Check?

**Health check is NOT from database** - it's a simple HTTP endpoint that App Runner calls to check if your app is running.

### How It Works:

1. **Your app exposes a `/health` endpoint** (in `main.ts` line 87-89)
   ```typescript
   app.getHttpAdapter().get('/health', (req: any, res: any) => {
     res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
   });
   ```

2. **App Runner calls this endpoint** (every 10-30 seconds)
   - If it gets `200 OK` → App is healthy ✅
   - If it gets connection refused/timeout → App is unhealthy ❌

3. **App Runner expects:**
   - App listening on port 8080
   - `/health` endpoint returns 200 OK
   - Response within timeout (5-10 seconds)

### Health Check Does NOT:
- ❌ Connect to database
- ❌ Check database status
- ❌ Call any complex logic
- ❌ Require authentication

### Health Check DOES:
- ✅ Check if app is running
- ✅ Check if port is open
- ✅ Check if HTTP server responds
- ✅ Return simple JSON: `{ status: 'ok', timestamp: '...' }`

---

## 🚨 Why Your App is Failing Health Check

**The problem is NOT the health check itself** - the problem is that **your app crashes during startup BEFORE the health check endpoint is even registered**.

### The Startup Flow:

1. App starts (`npm run start:prod`)
2. Node.js loads `dist/main.js`
3. `bootstrap()` function runs
4. **NestJS creates app** (`NestFactory.create(AppModule)`) ⚠️ **FAILS HERE**
   - This initializes ALL modules
   - **TypeORM tries to connect to Aurora** during module initialization
   - **If connection fails → App crashes → Exit code 1**
5. Health check endpoint never gets registered (app never reaches that line)
6. App Runner health check fails → Deployment rolls back

---

## ❌ What Could Be Causing the Failure?

### Issue #1: TypeORM Connection Failure (MOST LIKELY)

**What happens:**
- During `NestFactory.create(AppModule)`, TypeORM's `DatabaseModule` initializes
- TypeORM tries to **establish a connection to Aurora immediately**
- If connection fails → NestJS startup fails → App crashes

**Possible causes:**
- ❌ **DATABASE_URL format is wrong** (most likely)
- ❌ **Database not reachable from App Runner** (VPC/security group issue)
- ❌ **Wrong credentials** (username/password)
- ❌ **Wrong database name**
- ❌ **Connection timeout** (database slow to respond)

**Why SERVICE_UPDATE works but SERVICE_DEPLOY fails:**
- SERVICE_UPDATE uses previously built image (database connection might have been working)
- SERVICE_DEPLOY rebuilds everything, TypeORM tries fresh connection during startup
- If connection fails during fresh build → app crashes

### Issue #2: Supabase Auth Service Initialization (POSSIBLE)

**What happens:**
- `SupabaseAuthService` constructor runs during module initialization
- If Supabase URL/key is wrong → throws error → app crashes

**Possible causes:**
- ❌ **SUPABASE_URL is wrong**
- ❌ **SUPABASE_ANON_KEY is wrong**
- ❌ **Network issue** reaching Supabase

### Issue #3: Missing Environment Variables (POSSIBLE)

**What happens:**
- `main.ts` validates env vars at startup
- If missing → throws error → app crashes

**Possible causes:**
- ❌ **DATABASE_URL not set correctly**
- ❌ **SUPABASE_URL not set correctly**
- ❌ **SUPABASE_ANON_KEY not set correctly**

---

## 🔍 How to Diagnose the Error

### Step 1: Check App Runner Logs

Go to App Runner → Logs → Application logs, and look for:

**Pattern 1: Database Connection Error**
```
❌ [DatabaseModule] Failed to configure database
Error: Invalid URL
OR
Error: connection refused
OR
Error: timeout
```

**Pattern 2: Supabase Error**
```
❌ [SupabaseAuthService] Failed to initialize
Error: SUPABASE_URL must be set
OR
Error: Invalid Supabase URL
```

**Pattern 3: Module Initialization Error**
```
❌ [Bootstrap] Failed to create NestJS application
Error: ...
```

**Pattern 4: Missing Environment Variable**
```
❌ [Bootstrap] DATABASE_URL is required but not set
OR
❌ [Bootstrap] SUPABASE_URL is required but not set
```

---

## ✅ Most Likely Cause

**Based on the pattern (SERVICE_UPDATE works, SERVICE_DEPLOY fails):**

**Most likely:** **TypeORM connection to Aurora fails during fresh startup**

### Why This Happens:

1. **During SERVICE_DEPLOY**, App Runner:
   - Builds fresh code
   - Installs dependencies
   - Runs `npm run start:prod`
   - NestJS initializes modules
   - **TypeORM tries to connect to Aurora**
   - **If connection fails → App crashes**

2. **TypeORM fails immediately if:**
   - DATABASE_URL format is invalid (can't parse URL)
   - Database is unreachable (VPC/network issue)
   - Wrong credentials (auth fails)
   - Connection times out

### The Fix:

**Option 1: Make TypeORM connection lazy (recommended)**
- Don't connect during startup
- Connect on first use
- **But TypeORM doesn't support this by default**

**Option 2: Fix the actual connection issue**
1. Verify DATABASE_URL format in App Runner
2. Test database connectivity
3. Check VPC/security groups
4. Verify credentials

**Option 3: Add retry logic (already done)**
- We increased `retryAttempts: 5`
- We increased `retryDelay: 5000`
- But if connection is completely impossible, retries won't help

---

## 🎯 Action Plan

### Step 1: Check Logs (CRITICAL)

**Go to App Runner → Logs → Application logs**

Look for the error that says why it failed. Share that error here.

### Step 2: Verify DATABASE_URL Format

In App Runner → Configuration → Environment variables:

**Check DATABASE_URL is:**
```
postgresql://username:password@host:port/database
```

**Common mistakes:**
- ❌ Missing `postgresql://` protocol
- ❌ Missing `:5432` port
- ❌ Missing `/database` name
- ❌ Password with special characters not URL-encoded

### Step 3: Test Database Connectivity

From your local machine, test if you can connect:
```bash
psql "postgresql://user:pass@host:5432/database"
```

If this works locally but fails in App Runner, it's a network/VPC issue.

### Step 4: Check VPC Configuration

If App Runner and Aurora are in different VPCs/networks:
- App Runner can't reach Aurora
- Need VPC connector configured
- Security groups must allow traffic

---

## 💡 Summary

1. **Health check is simple HTTP endpoint** - doesn't touch database
2. **App crashes BEFORE health check** - during TypeORM connection
3. **Most likely cause:** TypeORM connection to Aurora fails during startup
4. **Fix:** Check App Runner logs to see exact error
5. **Verify:** DATABASE_URL format, VPC connectivity, security groups

**Please share the actual error logs from App Runner so we can fix this!**





