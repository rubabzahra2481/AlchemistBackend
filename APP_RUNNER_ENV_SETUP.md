# 🔧 App Runner Environment Variables Setup

## ❌ Problem
App Runner is rolling back because the application can't start without required environment variables.

## ✅ Solution
Add the following environment variables to your App Runner service.

---

## 📋 Required Environment Variables

You need to add these **4 environment variables** to App Runner:

### 1. **DATABASE_URL** (Required)
```
postgresql://admin_bs:YOUR_PASSWORD@brandscaling-aurora.cluster-cc1k8qu4cwi2.us-east-1.rds.amazonaws.com:5432/postgres
```
- **Replace** `YOUR_PASSWORD` with your actual Aurora Postgres password
- Format: `postgresql://username:password@host:port/database`

### 2. **SUPABASE_URL** (Required)
```
https://xuhkruljgrspjzluqyjo.supabase.co
```
- This is your Supabase project URL
- Get it from: Supabase Dashboard → Project Settings → API → Project URL

### 3. **SUPABASE_ANON_KEY** (Required)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1aGtydWxqZ3JzcGp6bHVxeWpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQyNDM5NjQsImV4cCI6MjA0OTgyOTk2NH0.xxx
```
- This is your Supabase anonymous/public key
- Get it from: Supabase Dashboard → Project Settings → API → Project API keys → `anon` `public`
- ⚠️ **IMPORTANT**: Use the `anon` key, NOT the `service_role` key

### 4. **OPENAI_API_KEY** (Required for LLM)
```
sk-proj-xxxxx
```
- Your OpenAI API key
- Get it from: https://platform.openai.com/api-keys

---

## 🚀 How to Add Environment Variables to App Runner

### **Step 1: Go to AWS App Runner Console**
1. Open [AWS App Runner Console](https://console.aws.amazon.com/apprunner)
2. Select your service (e.g., `AlchemistBackend`)

### **Step 2: Navigate to Configuration**
1. Click on **Configuration** tab (or **Service** → **Configuration**)
2. Scroll down to **Environment variables** section
3. Click **Edit**

### **Step 3: Add Environment Variables**
Click **Add environment variable** for each of the 4 variables:

| Key | Value | Description |
|-----|-------|-------------|
| `DATABASE_URL` | `postgresql://admin_bs:PASSWORD@brandscaling-aurora.cluster-cc1k8qu4cwi2.us-east-1.rds.amazonaws.com:5432/postgres` | Aurora Postgres connection string |
| `SUPABASE_URL` | `https://xuhkruljgrspjzluqyjo.supabase.co` | Supabase project URL |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Supabase anonymous key |
| `OPENAI_API_KEY` | `sk-proj-xxxxx` | OpenAI API key |

### **Step 4: Save and Deploy**
1. Click **Save changes**
2. App Runner will automatically trigger a new deployment
3. Wait for deployment to complete (usually 3-5 minutes)

---

## 🔍 How to Get Your Environment Variable Values

### **DATABASE_URL**
1. Check your local `.env` file in `backend/.env`
2. Copy the `DATABASE_URL` value
3. ⚠️ Make sure the password is correct (it might be different in production)

### **SUPABASE_URL and SUPABASE_ANON_KEY**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → Use as `SUPABASE_URL`
   - **Project API keys** → `anon` `public` key → Use as `SUPABASE_ANON_KEY`

### **OPENAI_API_KEY**
1. Check your local `.env` file in `backend/.env`
2. Copy the `OPENAI_API_KEY` value
3. Or create a new one at: https://platform.openai.com/api-keys

---

## ✅ Verify Environment Variables Are Set

After adding environment variables, verify they're set:

1. Go to App Runner → Your Service → **Configuration** → **Environment variables**
2. You should see all 4 variables listed:
   - ✅ `DATABASE_URL`
   - ✅ `SUPABASE_URL`
   - ✅ `SUPABASE_ANON_KEY`
   - ✅ `OPENAI_API_KEY`

---

## 🔄 After Adding Environment Variables

1. **App Runner will automatically redeploy** after you save
2. **Monitor the deployment:**
   - Go to **Deployments** tab
   - Wait for deployment to complete (Status: `Deployed` ✅)
3. **Check logs** if deployment fails:
   - Go to **Logs** tab
   - Look for startup logs:
     - ✅ `[Bootstrap] Starting application...`
     - ✅ `[Bootstrap] Environment variables check:`
     - ✅ `DATABASE_URL: ✅ Set`
     - ✅ `SUPABASE_URL: ✅ Set`
     - ✅ `SUPABASE_ANON_KEY: ✅ Set`

---

## ⚠️ Important Security Notes

1. **Never commit `.env` file to Git** - Environment variables contain secrets
2. **Use App Runner environment variables** - This is the secure way to store secrets in AWS
3. **Rotate keys regularly** - Update environment variables if you regenerate API keys
4. **Use IAM roles** - For AWS services, prefer IAM roles over access keys when possible

---

## 🐛 Troubleshooting

### **Deployment Still Rolling Back**
- Check App Runner **Logs** tab for specific errors
- Verify environment variable names are **exactly** as shown (case-sensitive)
- Ensure no extra spaces in values
- Verify database password is correct

### **Database Connection Failed**
- Check if Aurora Postgres security group allows App Runner IPs
- Verify `DATABASE_URL` format is correct
- Ensure Aurora cluster is in "Available" status

### **Supabase Authentication Failed**
- Verify you're using the `anon` key, not `service_role` key
- Check Supabase project is active
- Verify `SUPABASE_URL` matches your project URL

---

## 📝 Quick Checklist

- [ ] Added `DATABASE_URL` to App Runner
- [ ] Added `SUPABASE_URL` to App Runner
- [ ] Added `SUPABASE_ANON_KEY` to App Runner
- [ ] Added `OPENAI_API_KEY` to App Runner
- [ ] Saved configuration (triggers auto-deployment)
- [ ] Waited for deployment to complete
- [ ] Checked deployment status is "Deployed" ✅
- [ ] Tested health endpoint: `https://your-app-runner-url/health`

---

**Last Updated:** 2025-11-22
**Status:** Ready to configure App Runner environment variables

