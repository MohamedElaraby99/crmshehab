# Backend Scripts

This directory contains utility scripts for managing the CRM system backend.

## Available Scripts

### 1. createAdminUser.js
Creates or updates admin users in the system.

#### Usage
```bash
# Using npm script (recommended)
npm run create-admin
npm run create-admin:help

# Or directly with node
node scripts/createAdminUser.js
node scripts/createAdminUser.js --help
```

#### Options
- `-u, --username <username>` - Username for the admin user (default: admin)
- `-p, --password <password>` - Password for the admin user (default: admin123)
- `-r, --role <role>` - User role: admin, supplier, vendor (default: admin)
- `--supplier` - Mark user as supplier
- `--inactive` - Create inactive user
- `--update` - Update existing user instead of creating new one
- `-h, --help` - Show help message

#### Examples
```bash
# Create default admin user
npm run create-admin

# Create custom admin user
node scripts/createAdminUser.js --username myadmin --password mypass123

# Create supplier user
node scripts/createAdminUser.js --username supplier1 --role supplier --supplier

# Update existing user
node scripts/createAdminUser.js --username admin --password newpass --update
```

### 2. initFieldConfigs.js
Initializes default field configurations for the order form.

#### Usage
```bash
node scripts/initFieldConfigs.js
```

### 3. Other Scripts
- `checkFieldConfigs.js` - Check field configuration status
- `checkProducts.js` - Check product data
- `fixNotesField.js` - Fix notes field configuration

## Environment Setup
Make sure you have a `.env` file in the backend directory with the correct MongoDB URI:

```env
MONGODB_URI=mongodb://localhost:27017/crm_test_auth
```

## Notes
- All scripts automatically connect to and disconnect from MongoDB
- Scripts include proper error handling and validation
- Use `--help` flag with any script to see detailed usage information
