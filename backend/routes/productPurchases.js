const express = require('express');
const { body, validationResult } = require('express-validator');
const ProductPurchase = require('../models/ProductPurchase');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Get all product purchases
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      productId,
      vendorId,
      startDate,
      endDate,
      sortBy = 'purchaseDate',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };

    if (productId) {
      query.productId = productId;
    }

    if (vendorId) {
      query.vendorId = vendorId;
    }

    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate);
      if (endDate) query.purchaseDate.$lte = new Date(endDate);
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const purchases = await ProductPurchase.find(query)
      .populate('productId', 'name itemNumber')
      .populate('vendorId', 'name contactPerson')
      .populate('orderId', 'orderNumber')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ProductPurchase.countDocuments(query);

    res.json({
      success: true,
      data: purchases,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
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

// Get product purchase by ID
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const purchase = await ProductPurchase.findById(req.params.id)
      .populate('productId', 'name itemNumber description')
      .populate('vendorId', 'name contactPerson email phone')
      .populate('orderId', 'orderNumber status');

    if (!purchase || !purchase.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product purchase not found'
      });
    }

    res.json({
      success: true,
      data: purchase
    });
  } catch (error) {
    console.error('Get product purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create product purchase
router.post('/', [
  authenticateUser,
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('vendorId').isMongoId().withMessage('Valid vendor ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('purchaseDate').optional().isISO8601().withMessage('Valid date is required')
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

    const { productId, vendorId, quantity, price, purchaseDate, orderId, notes } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);
    if (!vendor || !vendor.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const totalAmount = quantity * price;

    const purchase = new ProductPurchase({
      productId,
      vendorId,
      vendorName: vendor.name,
      quantity,
      price,
      totalAmount,
      purchaseDate: purchaseDate || new Date(),
      orderId,
      notes
    });

    await purchase.save();
    await purchase.populate([
      { path: 'productId', select: 'name itemNumber' },
      { path: 'vendorId', select: 'name contactPerson' },
      { path: 'orderId', select: 'orderNumber' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Product purchase created successfully',
      data: purchase
    });
  } catch (error) {
    console.error('Create product purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update product purchase
router.put('/:id', [
  authenticateUser,
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('price').optional().isNumeric().withMessage('Price must be a number'),
  body('purchaseDate').optional().isISO8601().withMessage('Valid date is required'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes too long')
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

    const purchase = await ProductPurchase.findById(req.params.id);
    if (!purchase || !purchase.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product purchase not found'
      });
    }

    const updateData = {};
    if (req.body.quantity) updateData.quantity = req.body.quantity;
    if (req.body.price) updateData.price = req.body.price;
    if (req.body.purchaseDate) updateData.purchaseDate = req.body.purchaseDate;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;

    // Recalculate total amount if quantity or price changed
    if (req.body.quantity || req.body.price) {
      const newQuantity = req.body.quantity || purchase.quantity;
      const newPrice = req.body.price || purchase.price;
      updateData.totalAmount = newQuantity * newPrice;
    }

    const updatedPurchase = await ProductPurchase.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'productId', select: 'name itemNumber' },
      { path: 'vendorId', select: 'name contactPerson' },
      { path: 'orderId', select: 'orderNumber' }
    ]);

    res.json({
      success: true,
      message: 'Product purchase updated successfully',
      data: updatedPurchase
    });
  } catch (error) {
    console.error('Update product purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete product purchase (soft delete)
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const purchase = await ProductPurchase.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Product purchase not found'
      });
    }

    res.json({
      success: true,
      message: 'Product purchase deleted successfully'
    });
  } catch (error) {
    console.error('Delete product purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get purchase statistics
router.get('/statistics/overview', authenticateUser, async (req, res) => {
  try {
    const { startDate, endDate, productId, vendorId } = req.query;
    
    const query = { isActive: true };
    
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate);
      if (endDate) query.purchaseDate.$lte = new Date(endDate);
    }
    
    if (productId) query.productId = productId;
    if (vendorId) query.vendorId = vendorId;

    const purchases = await ProductPurchase.find(query);
    
    const totalPurchases = purchases.length;
    const totalQuantity = purchases.reduce((sum, p) => sum + p.quantity, 0);
    const totalAmount = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const averagePrice = totalQuantity > 0 ? totalAmount / totalQuantity : 0;
    const uniqueVendors = [...new Set(purchases.map(p => p.vendorId.toString()))].length;
    const uniqueProducts = [...new Set(purchases.map(p => p.productId.toString()))].length;

    res.json({
      success: true,
      data: {
        totalPurchases,
        totalQuantity,
        totalAmount,
        averagePrice,
        uniqueVendors,
        uniqueProducts
      }
    });
  } catch (error) {
    console.error('Get purchase statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
