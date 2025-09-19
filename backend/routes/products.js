const express = require('express');
const { body, validationResult } = require('express-validator');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const ProductPurchase = require('../models/ProductPurchase');
const Order = require('../models/Order');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all products
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { itemNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: products,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get product by ID
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get product purchase history
router.get('/:id/purchases', authenticateUser, async (req, res) => {
  try {
    const purchases = await ProductPurchase.find({ 
      productId: req.params.id,
      isActive: true 
    })
      .populate('orderId', 'orderNumber')
      .sort({ purchaseDate: -1 });

    // Calculate statistics
    const totalQuantity = purchases.reduce((sum, p) => sum + p.quantity, 0);
    const totalAmount = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const averagePrice = totalQuantity > 0 ? totalAmount / totalQuantity : 0;
    const uniqueVendors = [...new Set(purchases.map(p => p.vendorId.toString()))].length;
    const lastPurchase = purchases[0] || null;

    res.json({
      success: true,
      data: {
        purchases,
        statistics: {
          totalPurchases: purchases.length,
          totalQuantity,
          totalAmount,
          averagePrice,
          uniqueVendors,
          lastPurchase
        }
      }
    });
  } catch (error) {
    console.error('Get product purchases error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create product
router.post('/', [
  authenticateUser,
  requireAdmin,
  body('itemNumber').trim().isLength({ min: 1 }).withMessage('Item number is required'),
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('description').trim().isLength({ min: 1 }).withMessage('Description is required')
], async (req, res) => {
  try {
    console.log('Create product - received body:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Create product - validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { itemNumber, name, description, specifications } = req.body;

    // Check if item number already exists
    const existingProduct = await Product.findOne({ itemNumber });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Item number already exists'
      });
    }

    const product = new Product({
      itemNumber,
      name,
      description,
      specifications: specifications || {}
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update product
router.put('/:id', [
  authenticateUser,
  requireAdmin,
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Name cannot be empty'),
  body('description').optional().trim().isLength({ min: 1 }).withMessage('Description cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if item number is being changed and if it already exists
    if (req.body.itemNumber && req.body.itemNumber !== product.itemNumber) {
      const existingProduct = await Product.findOne({ itemNumber: req.body.itemNumber });
      if (existingProduct) {
        return res.status(400).json({
          success: false,
          message: 'Item number already exists'
        });
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete product (soft delete)
router.delete('/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get product statistics
router.get('/:id/statistics', authenticateUser, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get orders that contain this product
    const orders = await Order.find({ 
      'items.productId': req.params.id,
      isActive: true 
    })
    .populate('vendorId', 'name')
    .populate('items.productId', 'name');

    // Convert orders to purchase records
    const purchases = [];
    orders.forEach(order => {
      const productItem = order.items.find(item => item.productId._id.toString() === req.params.id);
      if (productItem) {
        purchases.push({
          id: `${order._id}_${productItem._id}`,
          productId: req.params.id,
          vendorId: typeof order.vendorId === 'string' ? order.vendorId : order.vendorId._id,
          vendorName: typeof order.vendorId === 'string' ? 'Unknown' : order.vendorId.name,
          quantity: productItem.quantity,
          price: productItem.unitPrice,
          totalAmount: productItem.totalPrice,
          purchaseDate: order.orderDate,
          orderId: order._id,
          notes: order.notes
        });
      }
    });

    const totalQuantity = purchases.reduce((sum, p) => sum + p.quantity, 0);
    const totalAmount = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const averagePrice = totalQuantity > 0 ? totalAmount / totalQuantity : 0;
    const uniqueVendors = [...new Set(purchases.map(p => p.vendorId.toString()))].length;
    const lastPurchase = purchases.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))[0] || null;

    res.json({
      success: true,
      data: {
        totalPurchases: purchases.length,
        totalQuantity,
        totalAmount,
        averagePrice,
        uniqueVendors,
        lastPurchase,
        purchases: purchases.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
      }
    });
  } catch (error) {
    console.error('Get product statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
