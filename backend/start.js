const mongoose = require('mongoose');
const User = require('./models/User');
const Supplier = require('./models/Supplier');
const Vendor = require('./models/Vendor');
const Product = require('./models/Product');
const Order = require('./models/Order');
const ProductPurchase = require('./models/ProductPurchase');

// Sample data for initial setup
const sampleData = {
  users: [
    {
      username: 'admin',
      password: 'admin123',
      role: 'admin',
      isSupplier: false
    },
    {
      username: 'supplierA',
      password: 'supplier123',
      role: 'supplier',
      isSupplier: true
    },
    {
      username: 'supplierB',
      password: 'supplier123',
      role: 'supplier',
      isSupplier: true
    }
  ],
  suppliers: [
    {
      name: 'Auto Parts Central',
      contactPerson: 'John Smith',
      email: 'john@autopartscentral.com',
      phone: '+1-555-0123',
      address: '123 Main Street',
      city: 'Detroit',
      country: 'USA',
      status: 'active'
    },
    {
      name: 'Global Motors Ltd',
      contactPerson: 'Sarah Johnson',
      email: 'sarah@globalmotors.com',
      phone: '+1-555-0456',
      address: '456 Business Ave',
      city: 'Chicago',
      country: 'USA',
      status: 'active'
    }
  ],
  vendors: [
    {
      name: 'Auto Parts Central',
      contactPerson: 'John Smith',
      email: 'john@autopartscentral.com',
      phone: '+1-555-0123',
      address: '123 Main Street',
      city: 'Detroit',
      country: 'USA',
      status: 'active',
      username: 'autoparts_central',
      password: 'AutoParts2024!'
    },
    {
      name: 'Global Motors',
      contactPerson: 'Sarah Johnson',
      email: 'sarah@globalmotors.com',
      phone: '+1-555-0456',
      address: '456 Business Ave',
      city: 'Chicago',
      country: 'USA',
      status: 'active',
      username: 'global_motors',
      password: 'GlobalMotors2024!'
    }
  ],
  products: [
    {
      itemNumber: 'ENG001',
      name: 'Engine Oil Filter',
      description: 'High-quality engine oil filter for all vehicle types',
      category: 'Engine Parts',
      price: 25.99,
      stock: 100,
      supplierId: null // Will be set after suppliers are created
    },
    {
      itemNumber: 'BRA002',
      name: 'Brake Pad Set',
      description: 'Premium brake pad set for front and rear wheels',
      category: 'Brake System',
      price: 89.99,
      stock: 50,
      supplierId: null
    },
    {
      itemNumber: 'SUS003',
      name: 'Shock Absorber',
      description: 'Heavy-duty shock absorber for smooth ride',
      category: 'Suspension',
      price: 150.00,
      stock: 30,
      supplierId: null
    }
  ]
};

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database with sample data...');

    // Clear existing data
    await User.deleteMany({});
    await Supplier.deleteMany({});
    await Vendor.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await ProductPurchase.deleteMany({});

    // Create users one by one
    const users = [];
    for (const userData of sampleData.users) {
      const user = new User(userData);
      await user.save();
      users.push(user);
    }
    console.log(`✅ Created ${users.length} users`);

    // Create suppliers
    const suppliers = await Supplier.insertMany(sampleData.suppliers);
    console.log(`✅ Created ${suppliers.length} suppliers`);

    // Update users with supplier IDs
    await User.findByIdAndUpdate(users[1]._id, { supplierId: suppliers[0]._id });
    await User.findByIdAndUpdate(users[2]._id, { supplierId: suppliers[1]._id });

    // Create vendors
    const vendors = await Vendor.insertMany(sampleData.vendors);
    console.log(`✅ Created ${vendors.length} vendors`);

    // Create user accounts for vendors
    for (const vendor of vendors) {
      const user = new User({
        username: vendor.username,
        password: vendor.password,
        role: 'vendor',
        isSupplier: false
      });
      await user.save();
      vendor.userId = user._id;
      await vendor.save();
    }

    // Update products with supplier IDs
    sampleData.products[0].supplierId = suppliers[0]._id;
    sampleData.products[1].supplierId = suppliers[1]._id;
    sampleData.products[2].supplierId = suppliers[0]._id;

    // Create products
    const products = await Product.insertMany(sampleData.products);
    console.log(`✅ Created ${products.length} products`);

    // Create sample orders
    const order1 = new Order({
      orderNumber: 'ORD-001',
      supplierId: suppliers[0]._id,
      vendorId: vendors[0]._id,
      items: [
        {
          productId: products[0]._id,
          itemNumber: products[0].itemNumber,
          quantity: 10,
          unitPrice: products[0].price,
          totalPrice: 10 * products[0].price
        }
      ],
      totalAmount: 10 * products[0].price,
      status: 'confirmed',
      confirmFormShehab: 'Order confirmed on Dec 20th',
      notes: 'Priority shipping requested'
    });

    const order2 = new Order({
      orderNumber: 'ORD-002',
      supplierId: suppliers[1]._id,
      vendorId: vendors[1]._id,
      items: [
        {
          productId: products[1]._id,
          itemNumber: products[1].itemNumber,
          quantity: 5,
          unitPrice: products[1].price,
          totalPrice: 5 * products[1].price
        }
      ],
      totalAmount: 5 * products[1].price,
      status: 'shipped',
      confirmFormShehab: 'Shipped on Dec 21st',
      notes: 'Express delivery'
    });

    await Order.insertMany([order1, order2]);
    console.log(`✅ Created 2 sample orders`);

    // Create sample product purchases
    const purchase1 = new ProductPurchase({
      productId: products[0]._id,
      vendorId: vendors[0]._id,
      vendorName: vendors[0].name,
      quantity: 10,
      price: products[0].price,
      totalAmount: 10 * products[0].price,
      purchaseDate: new Date('2024-01-15'),
      orderId: order1._id,
      notes: 'Bulk purchase for inventory'
    });

    const purchase2 = new ProductPurchase({
      productId: products[1]._id,
      vendorId: vendors[1]._id,
      vendorName: vendors[1].name,
      quantity: 5,
      price: products[1].price,
      totalAmount: 5 * products[1].price,
      purchaseDate: new Date('2024-01-20'),
      orderId: order2._id,
      notes: 'Regular maintenance order'
    });

    await ProductPurchase.insertMany([purchase1, purchase2]);
    console.log(`✅ Created 2 sample product purchases`);

    console.log('🎉 Database seeded successfully!');
    console.log('\n📋 Sample Accounts:');
    console.log('Admin: admin / admin123');
    console.log('Supplier A: supplierA / supplier123');
    console.log('Supplier B: supplierB / supplier123');
    console.log('Vendor A: autoparts_central / AutoParts2024!');
    console.log('Vendor B: global_motors / GlobalMotors2024!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  const mongoose = require('mongoose');
  require('dotenv').config();

  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crm_test_auth', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ Connected to MongoDB');
    return seedDatabase();
  })
  .then(() => {
    console.log('✅ Seeding completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
}

module.exports = { seedDatabase };
