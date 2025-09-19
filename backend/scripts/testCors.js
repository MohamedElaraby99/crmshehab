const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4031/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://crm.fikra.solutions';

async function testCorsConfiguration() {
  console.log('🧪 Testing CORS Configuration...\n');
  
  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health check endpoint...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`, {
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    console.log('✅ Health check passed:', healthResponse.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }

  try {
    // Test 2: Preflight request
    console.log('\n2️⃣ Testing preflight request...');
    const preflightResponse = await axios.options(`${API_BASE_URL}/auth/login`, {
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    console.log('✅ Preflight request passed');
    console.log('CORS Headers:', {
      'Access-Control-Allow-Origin': preflightResponse.headers['access-control-allow-origin'],
      'Access-Control-Allow-Methods': preflightResponse.headers['access-control-allow-methods'],
      'Access-Control-Allow-Headers': preflightResponse.headers['access-control-allow-headers'],
      'Access-Control-Allow-Credentials': preflightResponse.headers['access-control-allow-credentials']
    });
  } catch (error) {
    console.log('❌ Preflight request failed:', error.message);
  }

  try {
    // Test 3: Login request
    console.log('\n3️⃣ Testing login request...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    }, {
      headers: {
        'Origin': FRONTEND_URL,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Login request passed:', loginResponse.data.success ? 'Success' : 'Failed');
  } catch (error) {
    console.log('❌ Login request failed:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response headers:', error.response.headers);
    }
  }

  console.log('\n🎉 CORS testing completed!');
}

// Run the test
testCorsConfiguration().catch(console.error);
