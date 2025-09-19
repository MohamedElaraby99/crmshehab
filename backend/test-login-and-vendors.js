// Using built-in fetch (Node.js 18+)

async function testLoginAndVendors() {
  try {
    console.log('1. Testing login...');
    
    // First, login to get a real token
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('Login response:', loginData);
    
    if (loginData.success) {
      await testVendorsAPI(loginData.data.token);
    } else {
      console.log('Login failed, trying to create admin user...');
      
      // Try to create admin user first
      const createResponse = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
          role: 'admin'
        })
      });
      
      const createData = await createResponse.json();
      console.log('Create admin response:', createData);
      
      if (createData.success) {
        // Try login again
        const loginResponse2 = await fetch('http://localhost:5000/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: 'admin',
            password: 'admin123'
          })
        });
        
        const loginData2 = await loginResponse2.json();
        console.log('Second login response:', loginData2);
        
        if (loginData2.success) {
          await testVendorsAPI(loginData2.data.token);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testVendorsAPI(token) {
  console.log('\n2. Testing vendors API...');
  console.log('Token:', token);
  
  try {
    const response = await fetch('http://localhost:5000/api/vendors', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('\nVendors API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.data && data.data.length > 0) {
      const vendor = data.data[0];
      if (vendor.password) {
        console.log('\n✅ Password field is present:', vendor.password);
      } else {
        console.log('\n❌ Password field is missing!');
      }
    }
  } catch (error) {
    console.error('API Error:', error.message);
  }
}

testLoginAndVendors();
