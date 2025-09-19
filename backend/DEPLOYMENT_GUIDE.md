# Production Deployment Guide

## Current Issue
The CORS configuration has been fixed locally but needs to be deployed to production at `https://api.crm.fikra.solutions`.

## Quick Fix Options

### Option 1: Deploy Updated Code (Recommended)
1. **Upload the updated `server.js`** to your production server
2. **Restart the backend service** to apply changes
3. **Test the connection** from your frontend

### Option 2: Temporary CORS Override (Quick Fix)
If you can't deploy immediately, you can temporarily disable CORS restrictions:

```javascript
// TEMPORARY: Add this to your production server.js
app.use(cors({
  origin: true, // Allow all origins temporarily
  credentials: true
}));
```

### Option 3: Proxy Solution
Use a reverse proxy (like Nginx) to handle CORS:

```nginx
# Nginx configuration
location /api/ {
    add_header 'Access-Control-Allow-Origin' 'https://crm.fikra.solutions' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization' always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    
    if ($request_method = 'OPTIONS') {
        return 204;
    }
    
    proxy_pass http://localhost:4031;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Step-by-Step Deployment

### 1. Prepare the Updated Files
The following files need to be updated on your production server:

- `backend/server.js` (main CORS fixes)
- `backend/package.json` (new scripts)
- `backend/scripts/` (new utility scripts)

### 2. Upload Files to Production
```bash
# Upload the updated server.js
scp backend/server.js user@your-server:/path/to/your/app/

# Upload package.json
scp backend/package.json user@your-server:/path/to/your/app/

# Upload scripts directory
scp -r backend/scripts/ user@your-server:/path/to/your/app/
```

### 3. Restart the Backend Service
```bash
# If using PM2
pm2 restart your-app-name

# If using systemd
sudo systemctl restart your-backend-service

# If using Docker
docker-compose restart backend

# If running directly
# Kill the current process and restart
pkill -f "node server.js"
node server.js &
```

### 4. Verify the Deployment
```bash
# Test the health endpoint
curl https://api.crm.fikra.solutions/api/health

# Test CORS headers
curl -H "Origin: https://crm.fikra.solutions" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://api.crm.fikra.solutions/api/auth/login
```

## Environment Variables for Production

Create a `.env` file on your production server:

```env
NODE_ENV=production
PORT=4031
FRONTEND_URL=https://crm.fikra.solutions
MONGODB_URI=your-production-mongodb-connection-string
JWT_SECRET=your-secure-jwt-secret
```

## Testing After Deployment

### 1. Test CORS Headers
```bash
# Check if CORS headers are present
curl -I -X OPTIONS \
  -H "Origin: https://crm.fikra.solutions" \
  -H "Access-Control-Request-Method: POST" \
  https://api.crm.fikra.solutions/api/auth/login
```

You should see:
```
Access-Control-Allow-Origin: https://crm.fikra.solutions
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH
Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma
Access-Control-Allow-Credentials: true
```

### 2. Test Login Endpoint
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Origin: https://crm.fikra.solutions" \
  -d '{"username":"admin","password":"admin123"}' \
  https://api.crm.fikra.solutions/api/auth/login
```

### 3. Test from Frontend
1. Open your frontend at `https://crm.fikra.solutions`
2. Try to log in
3. Check browser developer tools for any remaining errors

## Troubleshooting

### If CORS errors persist:
1. **Clear browser cache** completely
2. **Check server logs** for any errors
3. **Verify the updated code is running** by checking the server response
4. **Test with different browsers** to rule out browser-specific issues

### If the server won't start:
1. **Check Node.js version** compatibility
2. **Verify all dependencies** are installed (`npm install`)
3. **Check MongoDB connection** string
4. **Review server logs** for specific error messages

## Rollback Plan

If something goes wrong, you can quickly rollback:

1. **Restore the previous `server.js`**
2. **Restart the service**
3. **Test basic functionality**

## Monitoring

After deployment, monitor:
- Server logs for CORS-related messages
- Frontend console for any remaining errors
- API response times and success rates

## Next Steps

1. Deploy the updated code
2. Test the frontend connection
3. Create an admin user if needed: `npm run create-admin`
4. Monitor for any issues
5. Update admin credentials for security
