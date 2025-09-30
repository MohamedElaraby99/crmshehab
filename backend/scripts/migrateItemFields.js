const mongoose = require('mongoose');
const Order = require('../models/Order');

// Connect to MongoDB
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_test_auth';
console.log('Connecting to MongoDB:', mongoUri);
mongoose.connect(mongoUri);

async function migrateItemFields() {
  try {
    console.log('Starting migration of item-level fields...');
    
    // First, let's check if we can connect and find any orders
    const totalOrders = await Order.countDocuments();
    console.log(`Total orders in database: ${totalOrders}`);
    
    const orders = await Order.find({ isActive: true });
    console.log(`Found ${orders.length} active orders to migrate`);
    
    if (orders.length === 0) {
      console.log('No active orders found. Checking all orders...');
      const allOrders = await Order.find();
      console.log(`Found ${allOrders.length} total orders (including inactive)`);
    }
    
    let updatedCount = 0;
    
    for (const order of orders) {
      let orderModified = false;
      
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        let itemModified = false;
        
        // Add missing item-level fields with default values
        if (!item.priceApprovalRejectionReason) {
          item.priceApprovalRejectionReason = '';
          itemModified = true;
        }
        
        if (!item.notes) {
          item.notes = '';
          itemModified = true;
        }
        
        if (!item.estimatedDateReady) {
          item.estimatedDateReady = '';
          itemModified = true;
        }
        
        if (!item.confirmFormShehab) {
          item.confirmFormShehab = '';
          itemModified = true;
        }
        
        if (!item.invoiceNumber) {
          item.invoiceNumber = '';
          itemModified = true;
        }
        
        if (item.transferAmount === undefined || item.transferAmount === null) {
          item.transferAmount = undefined;
          itemModified = true;
        }
        
        if (!item.shippingDateToAgent) {
          item.shippingDateToAgent = '';
          itemModified = true;
        }
        
        if (!item.shippingDateToSaudi) {
          item.shippingDateToSaudi = '';
          itemModified = true;
        }
        
        if (!item.arrivalDate) {
          item.arrivalDate = '';
          itemModified = true;
        }
        
        if (itemModified) {
          orderModified = true;
          console.log(`Updated item ${i} in order ${order.orderNumber}`);
        }
      }
      
      if (orderModified) {
        // Mark the items array as modified
        order.markModified('items');
        await order.save();
        updatedCount++;
        console.log(`Migrated order ${order.orderNumber} (${order.items.length} items)`);
      }
    }
    
    console.log(`Migration completed. Updated ${updatedCount} orders.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateItemFields();
