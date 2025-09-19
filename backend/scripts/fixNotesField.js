const mongoose = require('mongoose');
const FieldConfig = require('../models/FieldConfig');
require('dotenv').config();

async function fixNotesField() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-system');
    console.log('✅ Connected to MongoDB');
    
    // Find and update the notes field configuration
    const result = await FieldConfig.updateOne(
      { name: 'notes' },
      { $set: { required: false } }
    );
    
    if (result.modifiedCount > 0) {
      console.log('✅ Successfully updated Notes field to be optional (required: false)');
    } else if (result.matchedCount > 0) {
      console.log('ℹ️  Notes field was already set to optional');
    } else {
      console.log('❌ Notes field configuration not found');
    }
    
    // Verify the change
    const notesConfig = await FieldConfig.findOne({ name: 'notes' });
    if (notesConfig) {
      console.log('🔍 Notes field configuration after update:');
      console.log(`   - Required: ${notesConfig.required}`);
      console.log(`   - Editable by: ${notesConfig.editableBy}`);
      console.log(`   - Visible to: ${notesConfig.visibleTo}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

fixNotesField();
