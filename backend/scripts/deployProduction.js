const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function setupProductionEnvironment() {
  try {
    console.log('🚀 Setting up production environment...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_test_auth');
    console.log('✅ Connected to MongoDB');

    // Check if admin user exists
    const adminUser = await User.findOne({ username: 'admin', role: 'admin' });
    if (!adminUser) {
      console.log('⚠️  No admin user found. Creating default admin user...');
      
      const newAdmin = new User({
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        isSupplier: false,
        isActive: true
      });
      
      await newAdmin.save();
      console.log('✅ Default admin user created');
      console.log('   Username: admin');
      console.log('   Password: admin123');
      console.log('   ⚠️  IMPORTANT: Change the default password in production!');
    } else {
      console.log('✅ Admin user already exists');
    }

    // Display CORS configuration
    console.log('\n📋 CORS Configuration:');
    console.log('   Allowed Origins:');
    console.log('   - https://crm.fikra.solutions');
    console.log('   - http://localhost:5173 (development)');
    console.log('   - http://localhost:3000 (development)');
    
    console.log('\n🔧 Environment Variables:');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   PORT: ${process.env.PORT || 4031}`);
    console.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
    console.log(`   MONGODB_URI: ${process.env.MONGODB_URI ? 'Set' : 'Not set'}`);

    console.log('\n🎉 Production setup completed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Update your .env file with production values');
    console.log('   2. Change the default admin password');
    console.log('   3. Ensure your MongoDB is accessible from production');
    console.log('   4. Test the API endpoints with your frontend');
    
  } catch (error) {
    console.error('❌ Error setting up production environment:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run the setup
if (require.main === module) {
  setupProductionEnvironment().catch(console.error);
}

module.exports = { setupProductionEnvironment };
