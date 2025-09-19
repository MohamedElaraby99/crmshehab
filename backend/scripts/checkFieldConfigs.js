const mongoose = require('mongoose');
const FieldConfig = require('../models/FieldConfig');
require('dotenv').config();

async function checkFieldConfigs() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-system');
    console.log('✅ Connected to MongoDB');
    
    const configs = await FieldConfig.find({ isActive: true }).sort({ order: 1, name: 1 });
    console.log(`📋 Found ${configs.length} field configurations in database:`);
    
    if (configs.length === 0) {
      console.log('❌ No field configurations found!');
    } else {
      configs.forEach((config, index) => {
        console.log(`${index + 1}. ${config.name} (${config.label})`);
        console.log(`   - Required: ${config.required}`);
        console.log(`   - Editable by: ${config.editableBy}`);
        console.log(`   - Visible to: ${config.visibleTo}`);
        console.log('');
      });
      
      // Check specifically for notes field
      const notesConfig = configs.find(c => c.name === 'notes');
      if (notesConfig) {
        console.log('🔍 Notes field configuration:');
        console.log(`   - Required: ${notesConfig.required}`);
        console.log(`   - Editable by: ${notesConfig.editableBy}`);
        console.log(`   - Visible to: ${notesConfig.visibleTo}`);
      } else {
        console.log('❌ Notes field configuration not found in database');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

checkFieldConfigs();