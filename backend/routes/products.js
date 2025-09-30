const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const ProductPurchase = require('../models/ProductPurchase');
const Order = require('../models/Order');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Multer storage for product images (reuses /upload static dir)
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'upload'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});

const productUpload = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP allowed'));
  }
});

// Helper to compute stock from confirmed orders (without mutating DB)
const computeStockFromConfirmed = async (productId) => {
  const pid = String(productId);
  const orders = await Order.find({ status: 'confirmed', isActive: true }, { items: 1 });
  let total = 0;
  orders.forEach(o => {
    (o.items || []).forEach(it => {
      const itPid = (it.productId && it.productId._id) ? String(it.productId._id) : String(it.productId);
      if (itPid === pid) total += it.quantity || 0;
    });
  });
  return total;
};

// Helper to normalize product JSON (ensure stock is always present)
const normalizeProduct = (doc) => {
  const raw = typeof doc?.toJSON === 'function' ? doc.toJSON() : (doc || {});
  const obj = { ...raw };
  // Ensure id exists even for lean() results
  if (!obj.id && obj._id) {
    obj.id = String(obj._id);
    delete obj._id;
  }
  return {
    ...obj,
    stock: typeof obj.stock === 'number' ? obj.stock : 0,
    visibleToClients: typeof obj.visibleToClients === 'boolean' ? obj.visibleToClients : true,
  };
};

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

    // Hide products from any non-admin users if not visibleToClients
    try {
      if (!req.user || req.user.role !== 'admin') {
        query.visibleToClients = true;
      }
    } catch {}

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
      .select('itemNumber name description images specifications isActive createdAt updatedAt sellingPrice stock reorderLevel visibleToClients')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Product.countDocuments(query);

    // Normalize and backfill stock if zero
    const normalized = await Promise.all(products.map(async (p) => {
      const obj = normalizeProduct(p);
      if (!obj.stock || obj.stock === 0) {
        obj.stock = await computeStockFromConfirmed(obj.id);
      }
      return obj;
    }));

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: normalized.map(p => normalizeProduct(p)),
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

// Public/Client-visible products (separate endpoint)
router.get('/visible/list', authenticateUser, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true, visibleToClients: true };

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
      .select('itemNumber name description images specifications isActive createdAt updatedAt sellingPrice stock reorderLevel visibleToClients')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Product.countDocuments(query);

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: products.map(p => normalizeProduct(p)),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get visible products error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Alias: simpler path for visible products
router.get('/visible', authenticateUser, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true, visibleToClients: true };

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
      .select('itemNumber name description images specifications isActive createdAt updatedAt sellingPrice stock reorderLevel visibleToClients')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Product.countDocuments(query);

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: products.map(p => normalizeProduct(p)),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get visible products (alias) error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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

    const obj = normalizeProduct(product);
    if (!obj.stock || obj.stock === 0) {
      obj.stock = await computeStockFromConfirmed(obj.id);
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: obj
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
    const productId = req.params.id;
    let purchases = await ProductPurchase.find({ 
      productId,
      isActive: true 
    })
      .populate('orderId', 'orderNumber')
      .sort({ purchaseDate: -1 });

    // If no saved purchase records, fall back to confirmed orders to build history (non-persistent)
    if (!purchases || purchases.length === 0) {
      const pid = String(req.params.id);
      const orders = await Order.find({ 
        status: 'confirmed',
        isActive: true 
      })
      .populate('vendorId', 'name')
      .populate('items.productId', 'name');

      const computed = [];
      orders.forEach(order => {
        (order.items || []).forEach(productItem => {
          const itemPid = (productItem.productId && productItem.productId._id) ? String(productItem.productId._id) : String(productItem.productId);
          if (itemPid === pid) {
            computed.push({
              id: `${order._id}_${productItem._id}`,
              productId: pid,
              vendorId: typeof order.vendorId === 'string' ? order.vendorId : order.vendorId._id,
              vendorName: typeof order.vendorId === 'string' ? 'Unknown' : order.vendorId.name,
              quantity: productItem.quantity,
              price: productItem.unitPrice || 0,
              totalAmount: productItem.totalPrice || (productItem.unitPrice || 0) * (productItem.quantity || 0),
              purchaseDate: order.orderDate,
              orderId: order._id,
              notes: order.notes || ''
            });
          }
        });
      });

      // Sort newest first to match saved behavior
      computed.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));

      return res.json({
        success: true,
        data: {
          purchases: computed,
          statistics: {
            totalPurchases: computed.length,
            totalQuantity: computed.reduce((sum, p) => sum + (p.quantity || 0), 0),
            totalAmount: computed.reduce((sum, p) => sum + (p.totalAmount || 0), 0),
            averagePrice: (computed.reduce((sum, p) => sum + (p.totalAmount || 0), 0)) / (computed.reduce((sum, p) => sum + (p.quantity || 0), 0) || 1),
            uniqueVendors: [...new Set(computed.map(p => (p.vendorId || '').toString()))].length,
            lastPurchase: computed[0] || null
          }
        }
      });
    }

    // Saved purchases path
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
  body('description').optional().trim().isLength({ min: 1 }).withMessage('Description cannot be empty if provided'),
  body('sellingPrice').optional().isFloat({ min: 0 }).withMessage('sellingPrice must be >= 0'),
  body('stock').optional().isInt({ min: 0 }).withMessage('stock must be >= 0'),
  body('reorderLevel').optional().isInt({ min: 0 }).withMessage('reorderLevel must be >= 0'),
  body('visibleToClients').optional().isBoolean().withMessage('visibleToClients must be boolean')
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

    const { itemNumber, name, description, specifications, sellingPrice, stock, reorderLevel, visibleToClients } = req.body;

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
      specifications: specifications || {},
      ...(typeof sellingPrice !== 'undefined' ? { sellingPrice } : {}),
      ...(typeof stock !== 'undefined' ? { stock } : {}),
      ...(typeof visibleToClients !== 'undefined' ? { visibleToClients } : {}),
      ...(typeof reorderLevel !== 'undefined' ? { reorderLevel } : {})
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: normalizeProduct(product)
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
  body('description').optional().trim().isLength({ min: 1 }).withMessage('Description cannot be empty'),
  body('sellingPrice').optional().isFloat({ min: 0 }).withMessage('sellingPrice must be >= 0'),
  body('stock').optional().isInt({ min: 0 }).withMessage('stock must be >= 0'),
  body('reorderLevel').optional().isInt({ min: 0 }).withMessage('reorderLevel must be >= 0'),
  body('visibleToClients').optional().isBoolean().withMessage('visibleToClients must be boolean')
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

    const obj = normalizeProduct(updatedProduct);
    if (!obj.stock || obj.stock === 0) {
      obj.stock = await computeStockFromConfirmed(obj.id);
    }
    // Ensure visibleToClients is present in response
    obj.visibleToClients = typeof obj.visibleToClients === 'boolean' ? obj.visibleToClients : true;

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: obj
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
// Upload product image
router.post('/:id/image', [authenticateUser, requireAdmin, productUpload.single('image')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const imagePath = `/upload/${req.file.filename}`;
    // Prepend to images array; ensure it exists
    const images = Array.isArray(product.images) ? product.images : [];
    images.unshift(imagePath);

    product.images = images;
    await product.save();

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: { images: product.images }
    });
  } catch (error) {
    console.error('Upload product image error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
