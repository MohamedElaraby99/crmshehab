const mongoose = require('mongoose');
const User = require('./models/User');
const Vendor = require('./models/Vendor');

async function testVendorCreation() {
  try {
    await mongoose.connect('mongodb://localhost:27017/crm_test_auth');
    console.log('✅ Connected to database');

    // Test data
    const testVendorData = {
      name: 'Test Vendor',
      contactPerson: 'John Doe',
      email: 'test@example.com',
      phone: '1234567890',
      address: '123 Test St',
      city: 'Test City',
      country: 'Test Country',
      status: 'active'
    };

    // Generate username and password
    const username = testVendorData.name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20) + '_' + Date.now().toString().slice(-4);

    const password = 'TestPassword123!';

    console.log('Creating user with:', { username, password: '***' });

    // Create user account
    const user = new User({
      username,
      password,
      role: 'vendor',
      isSupplier: false
    });

    await user.save();
    console.log('✅ User created successfully');

    // Create vendor
    const vendor = new Vendor({
      name: testVendorData.name,
      contactPerson: testVendorData.contactPerson,
      email: testVendorData.email,
      phone: testVendorData.phone,
      address: testVendorData.address,
      city: testVendorData.city,
      country: testVendorData.country,
      status: testVendorData.status,
      username,
      password,
      userId: user._id
    });

    await vendor.save();
    console.log('✅ Vendor created successfully');

    // Clean up
    await User.findByIdAndDelete(user._id);
    await Vendor.findByIdAndDelete(vendor._id);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Database connection closed');
  }
}

testVendorCreation();

