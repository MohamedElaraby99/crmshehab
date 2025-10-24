const mongoose = require('mongoose');
require('dotenv').config();

async function checkProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_test_auth');
    const Product = require('./backend/models/Product');

    const products = await Product.find({}).limit(5).lean();
    console.log('=== FIRST 5 PRODUCTS ===');
    products.forEach((p, i) => {
      console.log(`\nProduct ${i+1}:`);
      console.log('itemNumber:', p.itemNumber);
      console.log('name:', p.name);
      console.log('images:', p.images || 'No images');
      console.log('---');
    });

    console.log(`\n=== TOTAL PRODUCTS: ${await Product.countDocuments()} ===`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProducts();
