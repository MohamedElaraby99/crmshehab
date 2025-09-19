# CORS Troubleshooting Guide

## Problem
The frontend at `https://crm.fikra.solutions` is unable to connect to the API at `https://api.crm.fikra.solutions` due to CORS (Cross-Origin Resource Sharing) policy errors.

## Error Messages
```
Access to fetch at 'https://api.crm.fikra.solutions/api/auth/login' from origin 'https://crm.fikra.solutions' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Solutions Implemented

### 1. Enhanced CORS Configuration
Updated `server.js` with comprehensive CORS settings:

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'https://crm.fikra.solutions',
      'http://localhost:3000',
      'http://localhost:5173'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Origin', 'X-Requested-With', 'Content-Type', 'Accept', 
    'Authorization', 'Cache-Control', 'Pragma'
  ],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200
};
```

### 2. Additional CORS Headers
Added manual CORS headers for all responses:

```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Expose-Headers', 'Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});
```

### 3. Helmet Configuration
Updated Helmet to allow cross-origin resources:

```javascript
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
```

## Testing the Fix

### 1. Test CORS Configuration
```bash
npm run test-cors
```

### 2. Test with curl
```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: https://crm.fikra.solutions" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  https://api.crm.fikra.solutions/api/auth/login

# Test actual request
curl -X POST \
  -H "Origin: https://crm.fikra.solutions" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  https://api.crm.fikra.solutions/api/auth/login
```

### 3. Check Response Headers
Look for these headers in the response:
- `Access-Control-Allow-Origin: https://crm.fikra.solutions`
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH`
- `Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma`

## Environment Variables

Make sure your production environment has these variables set:

```env
NODE_ENV=production
FRONTEND_URL=https://crm.fikra.solutions
MONGODB_URI=your-production-mongodb-uri
PORT=4031
```

## Deployment Checklist

1. ✅ CORS configuration updated
2. ✅ Helmet configuration updated
3. ✅ Preflight request handling added
4. ✅ Manual CORS headers added
5. ⏳ Deploy updated backend to production
6. ⏳ Test frontend connection
7. ⏳ Verify all API endpoints work

## Common Issues

### Issue: Still getting CORS errors after deployment
**Solution**: 
- Clear browser cache
- Check if the backend is actually running the updated code
- Verify environment variables are set correctly

### Issue: Preflight requests failing
**Solution**:
- Ensure the server responds to OPTIONS requests
- Check that all required headers are included in the response

### Issue: Credentials not being sent
**Solution**:
- Verify `credentials: true` is set in CORS config
- Check that frontend is sending credentials with requests

## Monitoring

Add logging to monitor CORS issues:

```javascript
app.use((req, res, next) => {
  console.log('Request Origin:', req.headers.origin);
  console.log('Request Method:', req.method);
  console.log('Request Headers:', req.headers);
  next();
});
```

## Next Steps

1. Deploy the updated backend code to production
2. Test the frontend connection
3. Monitor logs for any remaining CORS issues
4. Update admin user credentials if needed

## Support

If issues persist:
1. Check server logs for CORS-related errors
2. Verify the frontend is making requests to the correct API URL
3. Test with different browsers to rule out browser-specific issues
4. Use browser developer tools to inspect the actual request/response headers
