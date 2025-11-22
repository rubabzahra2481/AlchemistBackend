# AWS App Runner Configuration Fixes

## 🚨 Critical Issues Found

### 1. **DATABASE_URL is Incomplete** ❌
**Current Value:**
```
brandscaling-aurora-instance-1.cc1k8qu4cwi2.us-east-1.rds.amazonaws.com
```

**Issue:** This is just a hostname. The code expects a full PostgreSQL connection string.

**Required Format:**
```
postgresql://[username]:[password]@[host]:[port]/[database]
```

**Fixed Value (to update in AWS):**
```
postgresql://admin_bs:Brandscaling2025!@brandscaling-aurora.cluster-cc1k8qu4cwi2.us-east-1.rds.amazonaws.com:5432/postgres
```

**Note:** Replace `Brandscaling2025!` with your actual password if different. Use the **cluster endpoint** (not instance endpoint) for better reliability.

---

### 2. **Build Command is Wrong** ❌
**Current:** `npm install`  
**Issue:** Only installs dependencies, doesn't build TypeScript code.

**Fixed:** `npm run build`

This runs:
- `nest build` - Compiles TypeScript to JavaScript
- `node scripts/post-build.js` - Copies static files

---

### 3. **Start Command is Wrong** ❌
**Current:** `npm run start`  
**Issue:** Runs `nest start` which expects TypeScript files and uses ts-node for development.

**Fixed:** `npm run start:prod`

This runs: `node dist/main` - executes the compiled JavaScript in production mode.

---

### 4. **Health Check Configuration** ⚠️ (Optional but Recommended)
**Current:**
- Protocol: TCP
- Path: — (empty)
- Timeout: 5 seconds
- Interval: 10 seconds

**Recommended:**
- Protocol: **HTTP**
- Path: `/health`
- Timeout: **10 seconds**
- Interval: **30 seconds**

The `/health` endpoint is already implemented in `main.ts` and returns `{ status: 'ok', timestamp: '...' }`.

---

## ✅ Step-by-Step Fix Instructions

### Step 1: Update DATABASE_URL
1. Go to AWS App Runner Console → **alchemist-backend** → **Configuration** → **Runtime environment variables**
2. Find `DATABASE_URL`
3. Click **Edit**
4. Replace the value with:
   ```
   postgresql://admin_bs:YOUR_PASSWORD@brandscaling-aurora.cluster-cc1k8qu4cwi2.us-east-1.rds.amazonaws.com:5432/postgres
   ```
5. Replace `YOUR_PASSWORD` with your actual Aurora master password
6. Click **Save**

**Important:** Make sure you're using:
- The **cluster endpoint** (ends with `.cluster-...` not `.instance-...`)
- The correct **database name** (`postgres` based on your earlier configuration)
- The correct **username** (`admin_bs` or whatever you set during Aurora setup)

---

### Step 2: Fix Build Command
1. Go to **Configuration** → **Source and deployment** → **Configure build**
2. Find **Build command**
3. Change from: `npm install`
4. Change to: `npm run build`
5. Click **Save**

---

### Step 3: Fix Start Command
1. Go to **Configuration** → **Source and deployment** → **Configure build**
2. Find **Start command**
3. Change from: `npm run start`
4. Change to: `npm run start:prod`
5. Click **Save**

---

### Step 4: (Optional) Update Health Check
1. Go to **Configuration** → **Service settings** → **Edit**
2. Scroll to **Health check**
3. Change **Protocol** from `TCP` to `HTTP`
4. Set **Path** to: `/health`
5. Update **Timeout** to: `10 seconds`
6. Update **Interval** to: `30 seconds`
7. Click **Save**

---

## 📋 Summary of Required Changes

| Configuration | Current | Fixed | Priority |
|--------------|---------|-------|----------|
| **DATABASE_URL** | `brandscaling-aurora-instance-1...` (hostname only) | `postgresql://user:pass@host:port/db` (full connection string) | 🔴 **CRITICAL** |
| **Build command** | `npm install` | `npm run build` | 🔴 **CRITICAL** |
| **Start command** | `npm run start` | `npm run start:prod` | 🔴 **CRITICAL** |
| **Health check** | TCP, no path | HTTP, `/health` path | 🟡 **Recommended** |

---

## 🔍 Verification Steps

After making these changes:

1. **Trigger a new deployment** (App Runner will auto-deploy if you saved configuration)
2. **Check deployment logs** for:
   - ✅ Build successful (no TypeScript errors)
   - ✅ Database connection successful
   - ✅ Server started on port 8080
   - ✅ Health check passing

3. **Test the health endpoint:**
   ```bash
   curl https://ptvmvy9qhn.us-east-1.awsapprunner.com/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

4. **Test the API:**
   ```bash
   curl https://ptvmvy9qhn.us-east-1.awsapprunner.com/api
   ```
   Should return Swagger documentation HTML.

---

## 🐛 Troubleshooting

### If DATABASE_URL parsing fails:
- Ensure the format is exactly: `postgresql://user:password@host:port/database`
- Check that password doesn't contain special characters that need URL encoding
- Verify the database name exists in Aurora

### If build fails:
- Check that `package.json` has the `build` script
- Verify all dependencies are in `package.json` (not just `package-lock.json`)
- Check build logs for TypeScript errors

### If start fails:
- Ensure `dist/` directory exists after build
- Verify `dist/main.js` exists
- Check startup logs for database connection errors

### If health check fails:
- Verify the app is listening on the correct port (App Runner sets PORT=8080)
- Check that `/health` endpoint is accessible without authentication
- Review application logs for errors

---

## 📝 Notes

- **Port:** App Runner automatically sets `PORT=8080`. Your code uses `process.env.PORT || 3000`, so it will use 8080 automatically.
- **Database:** Based on your earlier conversation, tables are in the `postgres` database.
- **Security:** Consider storing sensitive values (like DATABASE_URL) in AWS Secrets Manager instead of plain environment variables.

