const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Default admin user configuration
const defaultAdmin = {
  username: 'admin',
  password: 'admin123',
  role: 'admin',
  isSupplier: false,
  isActive: true
};

async function createAdminUser(username, password, options = {}) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_test_auth');
    console.log('✅ Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log(`⚠️  User '${username}' already exists!`);
      
      // Ask if user wants to update the existing user
      if (options.update) {
        console.log('🔄 Updating existing user...');
        existingUser.password = password;
        existingUser.role = options.role || 'admin';
        existingUser.isActive = options.isActive !== undefined ? options.isActive : true;
        existingUser.updatedAt = new Date();
        
        await existingUser.save();
        console.log(`✅ User '${username}' updated successfully!`);
        console.log(`   - Role: ${existingUser.role}`);
        console.log(`   - Is Active: ${existingUser.isActive}`);
      } else {
        console.log('💡 Use --update flag to update existing user or choose a different username');
        return;
      }
    } else {
      // Create new admin user
      const adminUser = new User({
        username,
        password,
        role: options.role || 'admin',
        isActive: options.isActive !== undefined ? options.isActive : true
      });

      await adminUser.save();
      console.log(`✅ Admin user '${username}' created successfully!`);
      console.log(`   - Role: ${adminUser.role}`);
      console.log(`   - Is Active: ${adminUser.isActive}`);
    }

    console.log('\n🎉 Admin user setup completed!');
    console.log('📝 You can now use these credentials to log in to the system');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.code === 11000) {
      console.error('💡 Username already exists. Try a different username or use --update flag');
    }
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    username: defaultAdmin.username,
    password: defaultAdmin.password,
    role: 'admin',
    isActive: true,
    update: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--username':
      case '-u':
        options.username = args[++i];
        break;
      case '--password':
      case '-p':
        options.password = args[++i];
        break;
      case '--role':
      case '-r':
        options.role = args[++i];
        break;
      case '--supplier':
        break;
      case '--inactive':
        options.isActive = false;
        break;
      case '--update':
        options.update = true;
        break;
      case '--help':
      case '-h':
        console.log(`
🔧 Admin User Creation Script

Usage: node createAdminUser.js [options]

Options:
  -u, --username <username>    Username for the admin user (default: admin)
  -p, --password <password>    Password for the admin user (default: admin123)
  -r, --role <role>           User role: admin, supplier, vendor (default: admin)
  --supplier                  Mark user as supplier
  --inactive                  Create inactive user
  --update                    Update existing user instead of creating new one
  -h, --help                  Show this help message

Examples:
  node createAdminUser.js
  node createAdminUser.js --username myadmin --password mypass123
  node createAdminUser.js --username supplier1 --role supplier --supplier
  node createAdminUser.js --username admin --password newpass --update
        `);
        process.exit(0);
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`❌ Unknown option: ${arg}`);
          console.error('💡 Use --help to see available options');
          process.exit(1);
        }
        break;
    }
  }

  return options;
}

// Validate options
function validateOptions(options) {
  if (!options.username || options.username.length < 3) {
    console.error('❌ Username must be at least 3 characters long');
    process.exit(1);
  }
  
  if (!options.password || options.password.length < 6) {
    console.error('❌ Password must be at least 6 characters long');
    process.exit(1);
  }
  
  if (!['admin', 'supplier', 'vendor'].includes(options.role)) {
    console.error('❌ Role must be one of: admin, supplier, vendor');
    process.exit(1);
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Admin User Creation Script...\n');
  
  const options = parseArgs();
  validateOptions(options);
  
  console.log('📋 Configuration:');
  console.log(`   - Username: ${options.username}`);
  console.log(`   - Password: ${'*'.repeat(options.password.length)}`);
  console.log(`   - Role: ${options.role}`);
  console.log(`   - Is Active: ${options.isActive}`);
  console.log(`   - Update Mode: ${options.update}\n`);
  
  await createAdminUser(options.username, options.password, options);
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createAdminUser };
