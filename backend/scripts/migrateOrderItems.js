const mongoose = require('mongoose');
const Order = require('../models/Order');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_system');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migration script to add missing fields to existing order items
const migrateOrderItems = async () => {
  try {
    console.log('Starting migration of order items...');
    
    // Find all orders
    const orders = await Order.find({});
    console.log(`Found ${orders.length} orders to migrate`);
    
    let updatedCount = 0;
    
    for (const order of orders) {
      let needsUpdate = false;
      
      // Check if any item is missing the new fields
      for (const item of order.items) {
        if (item.priceApprovalStatus === undefined || 
            item.status === undefined ||
            item.notes === undefined ||
            item.estimatedDateReady === undefined) {
          needsUpdate = true;
          break;
        }
      }
      
      if (needsUpdate) {
        // Update items with default values for missing fields
        order.items = order.items.map(item => ({
          ...item.toObject(),
          priceApprovalStatus: item.priceApprovalStatus || 'pending',
          status: item.status || 'pending',
          notes: item.notes || '',
          estimatedDateReady: item.estimatedDateReady || ''
        }));
        
        await order.save();
        updatedCount++;
        console.log(`Updated order ${order.orderNumber} (${order._id})`);
      }
    }
    
    console.log(`Migration completed. Updated ${updatedCount} orders.`);
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run migration
if (require.main === module) {
  connectDB().then(() => {
    migrateOrderItems();
  });
}

module.exports = { migrateOrderItems };
