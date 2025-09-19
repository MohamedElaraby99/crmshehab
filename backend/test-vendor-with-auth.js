const mongoose = require('mongoose');
const User = require('./models/User');
const Vendor = require('./models/Vendor');
const { generateToken } = require('./middleware/auth');

async function testVendorCreationWithAuth() {
  try {
    await mongoose.connect('mongodb://localhost:27017/crm_test_auth');
    console.log('✅ Connected to database');

    // First, create an admin user for authentication
    const adminUser = new User({
      username: 'testadmin',
      password: 'admin123',
      role: 'admin',
      isSupplier: false
    });
    await adminUser.save();
    console.log('✅ Admin user created');

    // Generate token for authentication
    const token = generateToken({
      userId: adminUser._id,
      username: adminUser.username,
      role: adminUser.role,
      isSupplier: adminUser.isSupplier
    });
    console.log('✅ Token generated');

    // Test vendor creation data
    const vendorData = {
      name: 'Test Vendor Company',
      contactPerson: 'Jane Smith',
      email: 'jane@testvendor.com',
      phone: '555-0123',
      address: '456 Business Ave',
      city: 'Test City',
      country: 'Test Country',
      status: 'active'
    };

    console.log('Vendor data:', vendorData);

    // Simulate the vendor creation process
    const username = vendorData.name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20) + '_' + Date.now().toString().slice(-4);

    const password = 'TestPassword123!';

    console.log('Generated credentials:', { username, password: '***' });

    // Create user account for vendor
    const vendorUser = new User({
      username,
      password,
      role: 'vendor',
      isSupplier: false
    });

    await vendorUser.save();
    console.log('✅ Vendor user created');

    // Create vendor
    const vendor = new Vendor({
      name: vendorData.name,
      contactPerson: vendorData.contactPerson,
      email: vendorData.email,
      phone: vendorData.phone,
      address: vendorData.address,
      city: vendorData.city,
      country: vendorData.country,
      status: vendorData.status,
      username,
      password,
      userId: vendorUser._id
    });

    await vendor.save();
    console.log('✅ Vendor created successfully');

    // Clean up
    await User.findByIdAndDelete(adminUser._id);
    await User.findByIdAndDelete(vendorUser._id);
    await Vendor.findByIdAndDelete(vendor._id);
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Error details:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Database connection closed');
  }
}

testVendorCreationWithAuth();

