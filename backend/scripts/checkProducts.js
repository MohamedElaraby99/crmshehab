const mongoose = require('mongoose');
const Product = require('../models/Product');
require('dotenv').config();

async function checkProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_system');
    console.log('✅ Connected to MongoDB');
    
    const products = await Product.find({});
    console.log(`📦 Found ${products.length} products in database:`);
    
    if (products.length === 0) {
      console.log('❌ No products found!');
    } else {
      products.forEach((p, index) => {
        console.log(`${index + 1}. ${p.itemNumber} - ${p.name}`);
        console.log(`   - Has price: ${p.price !== undefined ? 'YES' : 'NO'}`);
        console.log(`   - Has stock: ${p.stock !== undefined ? 'YES' : 'NO'}`);
        console.log(`   - Has vendorId: ${p.vendorId !== undefined ? 'YES' : 'NO'}`);
        console.log(`   - Images: ${p.images && p.images.length > 0 ? p.images.join(', ') : 'NO IMAGES'}`);
        console.log(`   - Description: ${p.description}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

checkProducts();