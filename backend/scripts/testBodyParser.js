const axios = require('axios');
require('dotenv').config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4031/api';

async function testBodyParser() {
  console.log('🧪 اختبار Body Parser...\n');
  
  // Test 1: Valid JSON
  console.log('1️⃣ اختبار JSON صحيح...');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://crm.fikra.solutions'
      }
    });
    console.log('✅ JSON صحيح تم قبوله');
    console.log('الاستجابة:', response.data.success ? 'نجح' : 'فشل');
  } catch (error) {
    console.log('❌ خطأ في JSON صحيح:', error.response?.data || error.message);
  }

  // Test 2: Invalid JSON
  console.log('\n2️⃣ اختبار JSON غير صحيح...');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, 
      '{"username": "admin", "password": "admin123"', // Missing closing brace
      {
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://crm.fikra.solutions'
        }
      }
    );
    console.log('⚠️ JSON غير صحيح تم قبوله (غير متوقع)');
  } catch (error) {
    console.log('✅ JSON غير صحيح تم رفضه (متوقع)');
    console.log('الخطأ:', error.response?.data || error.message);
  }

  // Test 3: Missing Content-Type
  console.log('\n3️⃣ اختبار بدون Content-Type...');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    }, {
      headers: {
        'Origin': 'https://crm.fikra.solutions'
        // No Content-Type header
      }
    });
    console.log('✅ طلب بدون Content-Type تم قبوله');
  } catch (error) {
    console.log('❌ خطأ في طلب بدون Content-Type:', error.response?.data || error.message);
  }

  // Test 4: Large payload
  console.log('\n4️⃣ اختبار payload كبير...');
  try {
    const largeData = {
      username: 'admin',
      password: 'admin123',
      largeField: 'x'.repeat(1000000) // 1MB string
    };
    
    const response = await axios.post(`${API_BASE_URL}/auth/login`, largeData, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://crm.fikra.solutions'
      }
    });
    console.log('✅ Payload كبير تم قبوله');
  } catch (error) {
    console.log('❌ خطأ في payload كبير:', error.response?.data || error.message);
  }

  // Test 5: Wrong Content-Type
  console.log('\n5️⃣ اختبار Content-Type خاطئ...');
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, 
      'username=admin&password=admin123', // URL-encoded data
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://crm.fikra.solutions'
        }
      }
    );
    console.log('✅ Content-Type خاطئ تم قبوله');
  } catch (error) {
    console.log('❌ خطأ في Content-Type خاطئ:', error.response?.data || error.message);
  }

  console.log('\n📋 ملخص الاختبار:');
  console.log('إذا رأيت أخطاء، فهذا يعني أن Body Parser يعمل بشكل صحيح');
  console.log('إذا لم تر أخطاء، فقد تكون هناك مشكلة في الإعدادات');
}

// تشغيل الاختبار
testBodyParser().catch(console.error);
