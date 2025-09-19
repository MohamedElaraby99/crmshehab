const jwt = require('jsonwebtoken');

// Generate a test token
const token = jwt.sign(
  { userId: '68cc73f4c7dd9171ee79c780', username: 'admin', role: 'admin' },
  'your-secret-key'
);

console.log('Testing vendors API...');
console.log('Token:', token);

// Test the API
fetch('http://localhost:4031/api/vendors', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => {
  console.log('\nAPI Response:');
  console.log(JSON.stringify(data, null, 2));
  
  if (data.success && data.data && data.data.length > 0) {
    const vendor = data.data[0];
    if (vendor.password) {
      console.log('\n✅ Password field is present:', vendor.password);
    } else {
      console.log('\n❌ Password field is missing!');
    }
  }
})
.catch(error => {
  console.error('Error:', error.message);
});
