const axios = require('axios');

const PRODUCTION_API_URL = 'https://api.crm.fikra.solutions/api' || 'http://localhost:3000/api';

async function diagnoseProduction() {
  console.log('🔍 Diagnosing Production Server Issues...\n');
  console.log(`API URL: ${PRODUCTION_API_URL}\n`);

  // Test 1: Basic connectivity
  console.log('1️⃣ Testing basic connectivity...');
  try {
    const response = await axios.get(`${PRODUCTION_API_URL}/health`, {
      timeout: 5000,
      validateStatus: () => true // Don't throw on any status code
    });
    
    console.log('✅ Server is responding');
    console.log('Status:', response.status);
    console.log('Headers:', Object.keys(response.headers));
    
    if (response.status === 502) {
      console.log('❌ 502 Bad Gateway - Backend service is not running');
      console.log('💡 Solution: Restart your backend service');
    } else if (response.status === 200) {
      console.log('✅ Server is working correctly');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Connection refused - Server is down');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('❌ Connection timeout - Server is not responding');
    } else {
      console.log('❌ Error:', error.message);
    }
  }

  // Test 2: Check if it's a CORS issue
  console.log('\n2️⃣ Testing CORS headers...');
  try {
    const response = await axios.options(`${PRODUCTION_API_URL}/auth/login`, {
      headers: {
        'Origin': 'https://crm.fikra.solutions',
        'Access-Control-Request-Method': 'POST'
      },
      timeout: 5000,
      validateStatus: () => true
    });
    
    if (response.status === 200) {
      console.log('✅ CORS preflight is working');
      console.log('CORS Headers:');
      console.log('  Access-Control-Allow-Origin:', response.headers['access-control-allow-origin']);
      console.log('  Access-Control-Allow-Methods:', response.headers['access-control-allow-methods']);
    } else {
      console.log('❌ CORS preflight failed, status:', response.status);
    }
    
  } catch (error) {
    console.log('❌ CORS test failed:', error.message);
  }

  // Test 3: Check different endpoints
  console.log('\n3️⃣ Testing different endpoints...');
  const endpoints = ['/health', '/api/health', '/'];
  
  for (const endpoint of endpoints) {
    try {
      const url = `https://api.crm.fikra.solutions${endpoint}`;
      const response = await axios.get(url, {
        timeout: 3000,
        validateStatus: () => true
      });
      console.log(`✅ ${endpoint}: Status ${response.status}`);
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.message}`);
    }
  }

  console.log('\n📋 Diagnosis Summary:');
  console.log('If you see 502 errors, the backend service is not running.');
  console.log('If you see CORS errors, the backend is running but CORS is misconfigured.');
  console.log('If you see connection refused, the server is completely down.');
  
  console.log('\n🔧 Next Steps:');
  console.log('1. SSH into your production server');
  console.log('2. Check if Node.js process is running: ps aux | grep node');
  console.log('3. Check PM2 status: pm2 status');
  console.log('4. Restart the service: pm2 restart all');
  console.log('5. Check logs: pm2 logs');
}

// Run the diagnosis
diagnoseProduction().catch(console.error);
