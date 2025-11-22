# App Runner Startup Failure - Debug Guide

## 🔍 Problem Analysis

**Pattern Observed:**
- ✅ **SERVICE_UPDATE** (config-only changes) → **SUCCEEDS**
- ❌ **SERVICE_DEPLOY** (code changes from GitHub) → **FAILS** with "Container exit code: 1"

**This indicates:**
1. Environment variables are correct (config updates work)
2. **Build or Start commands might be wrong**
3. **OR** the new code has a runtime error during startup

## 🚨 Most Likely Issues

### Issue #1: Build/Start Commands Not Updated

**Current (WRONG):**
- Build command: `npm install` ❌ (only installs deps, doesn't build TypeScript)
- Start command: `npm run start` ❌ (runs dev server expecting TypeScript files)

**Should be:**
- Build command: `npm run build` ✅
- Start command: `npm run start:prod` ✅

### Issue #2: DATABASE_URL Format Still Wrong

Even if you updated it, check:
1. Format must be: `postgresql://user:password@host:port/database`
2. Use **cluster endpoint** (`.cluster-...`) not instance endpoint (`.instance-...`)
3. Password might have special characters that need URL encoding

### Issue #3: TypeORM Connection Fails During Startup

TypeORM tries to connect during NestJS module initialization. If connection fails, app crashes.

**Possible causes:**
- DATABASE_URL parsing fails (invalid URL format)
- Database is unreachable from App Runner (VPC/security group issue)
- Database credentials are wrong

## ✅ Step-by-Step Fix

### Step 1: Verify Build/Start Commands in App Runner

1. Go to AWS App Runner Console
2. Click **alchemist-backend** service
3. Go to **Configuration** → **Source and deployment** → **Configure build**
4. Verify:
   - **Build command:** Should be `npm run build`
   - **Start command:** Should be `npm run start:prod`

If they're wrong, fix them and save. This will trigger a SERVICE_UPDATE (should succeed).

### Step 2: Check Application Logs

1. Go to **Logs** tab in App Runner Console
2. Look for the most recent failed deployment
3. Check for:
   - `❌ [Bootstrap]` errors
   - `❌ [DatabaseModule]` errors
   - `DATABASE_URL` parsing errors
   - TypeORM connection errors

**Common error messages:**
- `"DATABASE_URL is not a valid URL"` → Format is wrong
- `"connection refused"` → Network/security group issue
- `"authentication failed"` → Wrong username/password
- `"database does not exist"` → Wrong database name

### Step 3: Verify DATABASE_URL Format

In App Runner → Configuration → Runtime environment variables:

**Check DATABASE_URL looks like:**
```
postgresql://admin_bs:YourPassword@brandscaling-aurora.cluster-cc1k8qu4cwi2.us-east-1.rds.amazonaws.com:5432/postgres
```

**Common mistakes:**
- ❌ Missing `postgresql://` protocol
- ❌ Missing `:5432` port
- ❌ Missing `/postgres` database name
- ❌ Using instance endpoint instead of cluster endpoint
- ❌ Special characters in password not URL-encoded

### Step 4: Test DATABASE_URL Format

Try parsing it locally:
```bash
node -e "try { const url = new URL(process.env.DATABASE_URL); console.log('Valid URL:', url.hostname, url.port, url.pathname); } catch(e) { console.error('Invalid URL:', e.message); }"
```

## 🔧 Quick Fixes

### Fix 1: Update Build/Start Commands (CRITICAL)

If not already done:

1. **Build command:** Change from `npm install` → `npm run build`
2. **Start command:** Change from `npm run start` → `npm run start:prod`

This is likely the main issue!

### Fix 2: Make Database Connection Non-Blocking

If database connection is the issue, we can make TypeORM not fail startup if database is temporarily unavailable.

**However, this is NOT recommended for production** - it's better to fix the connection issue.

### Fix 3: Add Better Error Handling

We already have comprehensive error logging. Check the logs to see what's actually failing.

## 📋 Checklist

Before next deployment, verify:

- [ ] Build command is `npm run build`
- [ ] Start command is `npm run start:prod`
- [ ] DATABASE_URL is full PostgreSQL connection string
- [ ] DATABASE_URL uses cluster endpoint (not instance)
- [ ] DATABASE_URL has correct database name (`postgres`)
- [ ] Password in DATABASE_URL is URL-encoded if needed
- [ ] VPC connector is configured (if using VPC)
- [ ] Security group allows App Runner → Aurora on port 5432

## 🐛 Debugging Steps

### 1. Check Latest Logs

Look at App Runner logs for the most recent failed deployment. The logs should show:
- Where the startup fails
- What error message is thrown
- Which environment variable is missing/wrong

### 2. Test Locally

Run locally with same env vars:
```bash
cd backend
DATABASE_URL="your-db-url" SUPABASE_URL="..." SUPABASE_ANON_KEY="..." npm run start:prod
```

If it works locally but fails in App Runner, it's likely a network/VPC issue.

### 3. Verify Database Connectivity

From App Runner VPC, test if database is reachable (if you have access to App Runner instances).

## 💡 Most Likely Solution

Based on the pattern (SERVICE_UPDATE succeeds, SERVICE_DEPLOY fails), the issue is almost certainly:

**Build/Start commands are still wrong.**

SERVICE_UPDATE uses the previously built image (which worked), but SERVICE_DEPLOY tries to rebuild with wrong commands.

**Fix:**
1. Update Build command to: `npm run build`
2. Update Start command to: `npm run start:prod`
3. Save configuration
4. Wait for deployment to complete

This should fix the issue!

