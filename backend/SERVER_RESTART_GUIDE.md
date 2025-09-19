# Server Restart Guide - Fix 502 Bad Gateway

## Problem
Your production server is returning **502 Bad Gateway** errors, which means the backend Node.js service is not running.

## Quick Fix Commands

### 1. Check Current Status
```bash
# SSH into your production server first
ssh user@your-server-ip

# Check if Node.js is running
ps aux | grep node

# Check if port 4031 is in use
netstat -tlnp | grep :4031

# Check PM2 status (if using PM2)
pm2 status

# Check systemd services
sudo systemctl status | grep node
```

### 2. Restart Backend Service

#### If using PM2 (Most Common)
```bash
# List all PM2 processes
pm2 list

# Restart all processes
pm2 restart all

# Or restart specific app
pm2 restart your-app-name

# Check logs
pm2 logs

# If PM2 is not running, start it
pm2 start server.js --name "crm-backend"
```

#### If using systemd
```bash
# Find your service name
sudo systemctl list-units --type=service | grep node

# Restart the service
sudo systemctl restart your-backend-service-name

# Check status
sudo systemctl status your-backend-service-name

# Check logs
sudo journalctl -u your-backend-service-name -f
```

#### If using Docker
```bash
# Check running containers
docker ps

# Restart backend container
docker-compose restart backend

# Or restart specific container
docker restart container-name

# Check logs
docker logs container-name
```

#### If running directly
```bash
# Kill existing process
pkill -f "node server.js"

# Navigate to app directory
cd /path/to/your/crm/backend

# Start the server
node server.js &

# Or use nohup to keep it running
nohup node server.js > server.log 2>&1 &
```

### 3. Check Nginx Configuration
```bash
# Test Nginx configuration
sudo nginx -t

# Reload Nginx if config is OK
sudo systemctl reload nginx

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### 4. Verify the Fix
```bash
# Test the API endpoint
curl https://api.crm.fikra.solutions/api/health

# Should return JSON response, not 502 error
```

## Common Issues and Solutions

### Issue: PM2 not found
```bash
# Install PM2 globally
npm install -g pm2

# Or use npx
npx pm2 start server.js --name "crm-backend"
```

### Issue: Port already in use
```bash
# Find what's using port 4031
sudo lsof -i :4031

# Kill the process
sudo kill -9 PID_NUMBER
```

### Issue: Permission denied
```bash
# Check file permissions
ls -la server.js

# Make sure Node.js can read the file
chmod 644 server.js
```

### Issue: Missing dependencies
```bash
# Install dependencies
npm install

# Check if all required packages are installed
npm list
```

## Step-by-Step Recovery

### Step 1: Access Your Server
```bash
ssh user@your-server-ip
```

### Step 2: Navigate to App Directory
```bash
cd /path/to/your/crm/backend
```

### Step 3: Check App Status
```bash
# Check if PM2 is running
pm2 status

# If PM2 shows "errored" or "stopped", restart it
pm2 restart all
```

### Step 4: Check Logs
```bash
# Check PM2 logs for errors
pm2 logs --lines 50

# Look for error messages like:
# - "Cannot find module"
# - "Port already in use"
# - "Permission denied"
# - "MongoDB connection failed"
```

### Step 5: Fix Common Issues
```bash
# If missing dependencies
npm install

# If port conflict
pkill -f "node server.js"
pm2 restart all

# If permission issues
sudo chown -R $USER:$USER /path/to/your/app
```

### Step 6: Test the Fix
```bash
# Test locally on server
curl http://localhost:4031/api/health

# Test from external
curl https://api.crm.fikra.solutions/api/health
```

## Prevention

### Set up PM2 to auto-restart
```bash
# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup

# Follow the instructions it gives you
```

### Monitor the service
```bash
# Install PM2 monitoring
pm2 install pm2-logrotate

# Set up monitoring
pm2 monit
```

## Emergency Fallback

If nothing works, try this minimal setup:

```bash
# Kill everything
pkill -f node
pkill -f pm2

# Start fresh
cd /path/to/your/crm/backend
npm install
node server.js
```

## After Fixing

Once the server is running:

1. **Test the frontend** - Try logging in
2. **Check CORS** - Run `npm run diagnose-production`
3. **Monitor logs** - Keep an eye on `pm2 logs`
4. **Set up monitoring** - Use PM2 monitoring tools

## Need Help?

If you're still having issues:

1. **Check server resources**: `htop` or `top`
2. **Check disk space**: `df -h`
3. **Check memory**: `free -h`
4. **Check system logs**: `sudo journalctl -f`
