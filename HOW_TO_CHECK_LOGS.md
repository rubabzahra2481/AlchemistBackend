# How to Check App Runner Application Logs

## 📋 Step-by-Step Guide

### Step 1: Access App Runner Console
1. Go to AWS Console
2. Navigate to **App Runner** service
3. Click on **alchemist-backend** service

### Step 2: View Logs
1. Click on **Logs** tab
2. Select **Application logs** (not build logs)
3. Look at the most recent failed deployment timestamp

### Step 3: What to Look For

Search for these keywords in the logs:

**Error indicators:**
- `❌ [Bootstrap]` - Startup errors
- `❌ [DatabaseModule]` - Database configuration errors
- `Error:` - Any errors
- `Failed to start` - Startup failures

**Success indicators:**
- `✅ [Bootstrap] NestJS application created`
- `✅ [DatabaseModule] Database configuration created successfully`
- `🧠 Quotient Advisor Agent is running!`

### Step 4: Common Error Messages

**If you see:**
- `"DATABASE_URL is not a valid URL"` → DATABASE_URL format is wrong
- `"DATABASE_URL is not set"` → Missing environment variable
- `"connection refused"` → Network/VPC/security group issue
- `"authentication failed"` → Wrong username/password
- `"database does not exist"` → Wrong database name

**If you see:**
- `"Cannot find module"` → Build failed or wrong start command
- `"dist/main" not found` → Build didn't run or failed

## 🔍 Expected Log Flow (Success)

1. `🚀 [Bootstrap] Starting application...`
2. `📋 [Bootstrap] Environment variables check:`
3. `✅ Set` for all required env vars
4. `📦 [Bootstrap] Creating NestJS application...`
5. `🗄️ [DatabaseModule] Initializing database connection...`
6. `✅ [DatabaseModule] DATABASE_URL found`
7. `✅ [Bootstrap] NestJS application created`
8. `🌐 [Bootstrap] Starting server on port 8080...`
9. `🧠 Quotient Advisor Agent is running!`

## ❌ Failure Patterns

**Pattern 1: Missing Environment Variable**
```
❌ [Bootstrap] DATABASE_URL is required but not set
❌ [Bootstrap] Failed to start application
```

**Pattern 2: Invalid DATABASE_URL Format**
```
❌ [DatabaseModule] DATABASE_URL is not a valid URL
❌ [DatabaseModule] Failed to configure database
```

**Pattern 3: Database Connection Failed**
```
❌ [DatabaseModule] Connection failed: connection refused
❌ [Bootstrap] Failed to start application
```

**Pattern 4: Build/Start Command Wrong**
```
Error: Cannot find module 'dist/main'
or
Error: Cannot find module './src/app.module'
```

## 💡 What to Share

If you want help debugging, share:
1. The error messages from logs
2. Any lines starting with `❌`
3. The last few lines before the crash





