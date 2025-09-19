const fs = require('fs');
const path = require('path');

// This script creates a quick CORS fix for production
// Run this on your production server to temporarily fix CORS issues

const quickCorsFix = `
// Quick CORS Fix - Add this to the top of your server.js after the imports
// and before any other middleware

// TEMPORARY CORS FIX - Replace existing CORS configuration with this
app.use((req, res, next) => {
  // Allow all origins temporarily
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Expose-Headers', 'Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Remove or comment out the existing CORS configuration
// app.use(cors({ ... }));
`;

const serverJsPath = path.join(__dirname, '..', 'server.js');

function applyQuickFix() {
  try {
    console.log('🔧 Applying quick CORS fix...');
    
    // Read current server.js
    let serverContent = fs.readFileSync(serverJsPath, 'utf8');
    
    // Check if fix is already applied
    if (serverContent.includes('Quick CORS Fix')) {
      console.log('⚠️  Quick CORS fix already applied!');
      return;
    }
    
    // Find the CORS configuration section and replace it
    const corsRegex = /app\.use\(cors\(\{[^}]+\}\)\);/g;
    const corsOptionsRegex = /const corsOptions = \{[\s\S]*?\};\s*app\.use\(cors\(corsOptions\)\);/g;
    
    // Replace CORS configuration
    let newContent = serverContent.replace(corsOptionsRegex, quickCorsFix);
    newContent = newContent.replace(corsRegex, '// ' + serverContent.match(corsRegex)[0]);
    
    // Write the updated content
    fs.writeFileSync(serverJsPath, newContent);
    
    console.log('✅ Quick CORS fix applied successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Test the frontend connection');
    console.log('   3. Deploy the proper CORS configuration when possible');
    
  } catch (error) {
    console.error('❌ Error applying quick fix:', error.message);
    console.log('💡 Manual fix required - see DEPLOYMENT_GUIDE.md');
  }
}

// Run the fix
if (require.main === module) {
  applyQuickFix();
}

module.exports = { applyQuickFix };
