const mongoose = require('mongoose');
const FieldConfig = require('../models/FieldConfig');
require('dotenv').config();

const defaultConfigs = [
  {
    name: 'itemNumber',
    label: 'Item Number',
    type: 'text',
    required: true,
    editableBy: 'admin',
    visibleTo: 'both',
    placeholder: 'e.g., 68240575AB(iron)',
    order: 1
  },
  {
    name: 'productName',
    label: 'Product Name',
    type: 'text',
    required: true,
    editableBy: 'admin',
    visibleTo: 'both',
    placeholder: 'Product description',
    order: 2
  },
  {
    name: 'quantity',
    label: 'Quantity',
    type: 'number',
    required: true,
    editableBy: 'admin',
    visibleTo: 'both',
    validation: { min: 1 },
    order: 3
  },
  {
    name: 'price',
    label: 'Price ($)',
    type: 'number',
    required: true,
    editableBy: 'admin',
    visibleTo: 'both',
    validation: { min: 0 },
    order: 4
  },
  {
    name: 'vendorId',
    label: 'Vendor',
    type: 'select',
    required: true,
    editableBy: 'admin',
    visibleTo: 'both',
    order: 5
  },
  {
    name: 'confirmFormShehab',
    label: 'Confirm Form Shehab',
    type: 'text',
    required: false,
    editableBy: 'admin',
    visibleTo: 'both',
    placeholder: 'e.g., Dec.20th, Nov.08',
    order: 6
  },
  {
    name: 'estimatedDateReady',
    label: 'Estimated Date to be Ready',
    type: 'date',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both',
    placeholder: 'Vendor will fill this',
    order: 7
  },
  {
    name: 'invoiceNumber',
    label: 'Invoice Number',
    type: 'text',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both',
    placeholder: 'e.g., MS002',
    order: 8
  },
  {
    name: 'transferAmount',
    label: 'Transfer Amount ($)',
    type: 'number',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both',
    validation: { min: 0 },
    order: 9
  },
  {
    name: 'shippingDateToAgent',
    label: 'Shipping Date to Agent',
    type: 'date',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both',
    order: 10
  },
  {
    name: 'shippingDateToSaudi',
    label: 'Shipping Date to Saudi Arabia',
    type: 'date',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both',
    order: 11
  },
  {
    name: 'arrivalDate',
    label: 'Arrival Date',
    type: 'date',
    required: false,
    editableBy: 'vendor',
    visibleTo: 'both',
    order: 12
  },
  {
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    required: false,
    editableBy: 'both',
    visibleTo: 'both',
    placeholder: 'Additional information',
    order: 13
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    required: false,
    editableBy: 'admin',
    visibleTo: 'both',
    options: [
      { value: 'pending', label: 'Pending' },
      { value: 'confirmed', label: 'Confirmed' },
      { value: 'shipped', label: 'Shipped' },
      { value: 'delivered', label: 'Delivered' },
      { value: 'cancelled', label: 'Cancelled' }
    ],
    order: 14
  }
];

async function initializeFieldConfigs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-system');
    console.log('✅ Connected to MongoDB');

    // Clear existing field configs
    await FieldConfig.deleteMany({});
    console.log('🗑️  Cleared existing field configurations');

    // Insert default configurations
    const createdConfigs = await FieldConfig.insertMany(
      defaultConfigs.map(config => ({ ...config, isActive: true }))
    );

    console.log(`✅ Created ${createdConfigs.length} default field configurations:`);
    createdConfigs.forEach(config => {
      console.log(`   - ${config.label} (${config.name}): ${config.editableBy}/${config.visibleTo}`);
    });

    console.log('\n🎉 Field configurations initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing field configurations:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run the initialization
initializeFieldConfigs();
