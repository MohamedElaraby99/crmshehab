const axios = require('axios');

const PRODUCTION_API_URL = 'https://api.crm.fikra.solutions/api';
const FRONTEND_URL = 'https://crm.fikra.solutions';

async function testProductionCors() {
  console.log('🧪 Testing Production CORS Configuration...\n');
  console.log(`API URL: ${PRODUCTION_API_URL}`);
  console.log(`Frontend URL: ${FRONTEND_URL}\n`);

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health check...');
    const healthResponse = await axios.get(`${PRODUCTION_API_URL}/health`, {
      headers: {
        'Origin': FRONTEND_URL
      }
    });
    console.log('✅ Health check passed');
    console.log('Response:', healthResponse.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Headers:', error.response.headers);
    }
  }

  try {
    // Test 2: Preflight request
    console.log('\n2️⃣ Testing preflight request...');
    const preflightResponse = await axios.options(`${PRODUCTION_API_URL}/auth/login`, {
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    console.log('✅ Preflight request passed');
    console.log('CORS Headers:');
    console.log('  Access-Control-Allow-Origin:', preflightResponse.headers['access-control-allow-origin']);
    console.log('  Access-Control-Allow-Methods:', preflightResponse.headers['access-control-allow-methods']);
    console.log('  Access-Control-Allow-Headers:', preflightResponse.headers['access-control-allow-headers']);
    console.log('  Access-Control-Allow-Credentials:', preflightResponse.headers['access-control-allow-credentials']);
  } catch (error) {
    console.log('❌ Preflight request failed:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Headers:', error.response.headers);
    }
  }

  try {
    // Test 3: Actual login request
    console.log('\n3️⃣ Testing login request...');
    const loginResponse = await axios.post(`${PRODUCTION_API_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    }, {
      headers: {
        'Origin': FRONTEND_URL,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Login request passed');
    console.log('Success:', loginResponse.data.success);
  } catch (error) {
    console.log('❌ Login request failed:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Response:', error.response.data);
    }
  }

  console.log('\n📋 Summary:');
  console.log('If you see CORS errors, the production server needs to be updated with the new CORS configuration.');
  console.log('Check the DEPLOYMENT_GUIDE.md for instructions on how to deploy the fixes.');
}

// Run the test
testProductionCors().catch(console.error);
