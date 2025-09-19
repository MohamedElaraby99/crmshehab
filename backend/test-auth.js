const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function testAuth() {
  try {
    // Connect to a completely new database
    await mongoose.connect('mongodb://localhost:27017/crm_test_auth', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to test database');

    // Clear any existing data
    await User.deleteMany({});
    console.log('✅ Cleared existing users');

    // Create a test user
    const testUser = new User({
      username: 'admin',
      password: 'admin123',
      role: 'admin'
    });

    await testUser.save();
    console.log('✅ Created test user');

    // Test authentication
    const foundUser = await User.findOne({ username: 'admin' });
    if (foundUser) {
      const isPasswordValid = await foundUser.comparePassword('admin123');
      console.log('✅ Password validation:', isPasswordValid);
      
      if (isPasswordValid) {
        console.log('✅ Authentication test passed!');
      } else {
        console.log('❌ Password validation failed');
      }
    } else {
      console.log('❌ User not found');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
}

testAuth();
