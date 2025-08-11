# 🚨 AWS Server Fix Instructions

## Problem Identified
The server cannot find modules due to unresolved TypeScript path aliases (`@/controllers/auth.controller`). The `tsc-alias` package should resolve these, but it's not working properly on the server.

## 🔧 Immediate Fix Steps

### Step 1: Connect to AWS Server
```bash
ssh -i your-key.pem ubuntu@your-aws-server-ip
cd /home/ubuntu/inventario/inventory-app/backend
```

### Step 2: Stop PM2 Process
```bash
pm2 stop backend
pm2 delete backend
```

### Step 3: Clean and Rebuild
```bash
# Remove old dist folder
rm -rf dist/

# Install dependencies (ensure tsc-alias is available)
npm install

# Rebuild with proper alias resolution
npm run build
```

### Step 4: Verify Build Output
```bash
# Check if aliases were resolved correctly
head -10 dist/routes/auth.routes.js
```

You should see:
```javascript
const auth_controller_1 = require("../controllers/auth.controller");
// NOT: require("@/controllers/auth.controller")
```

### Step 5: Alternative - Manual Path Fix (If tsc-alias fails)
If the build still shows unresolved aliases, use this quick fix:

```bash
# Replace all @/ paths with relative paths in compiled files
find dist/ -name "*.js" -exec sed -i 's|require("@/|require("../|g' {} \;
find dist/ -name "*.js" -exec sed -i 's|from "@/|from "../|g' {} \;
```

### Step 6: Start PM2 Again
```bash
# Start from the dist directory
pm2 start dist/index-simple.js --name "backend"

# Or if using an ecosystem file
pm2 start ecosystem.config.js
```

### Step 7: Check Logs
```bash
pm2 logs backend
```

## 🔍 Alternative Solution - Update Package.json Start Script

If the path resolution continues to fail, update the start script to use module-alias:

### Option A: Install module-alias
```bash
npm install module-alias
```

### Option B: Modify index-simple.js
Add this to the very beginning of your `dist/index-simple.js`:

```javascript
const moduleAlias = require('module-alias');
moduleAlias.addAliases({
  '@': __dirname,
  '@controllers': __dirname + '/controllers',
  '@middlewares': __dirname + '/middlewares',
  '@routes': __dirname + '/routes',
  '@config': __dirname + '/config',
  '@utils': __dirname + '/utils',
  '@types': __dirname + '/types'
});
```

## 🧪 Quick Test Commands

After fixing:

```bash
# Test if the server starts correctly
curl http://localhost:3000/api/health

# Test auth endpoint
curl http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "password": "test"}'
```

## 📋 Verification Checklist

✅ PM2 process stops cleanly  
✅ `npm run build` completes without errors  
✅ Compiled files use relative paths (not @/ aliases)  
✅ PM2 starts without module errors  
✅ Login endpoint responds correctly  

## 🚨 If Problems Persist

1. **Check Node.js version**: Ensure compatible version
2. **Check file permissions**: Ensure ubuntu user owns all files
3. **Check environment variables**: Verify all required env vars are set
4. **Manual compilation**: Try compiling individual files to isolate the issue

---

**Priority**: HIGH - This needs to be fixed for the application to work properly.