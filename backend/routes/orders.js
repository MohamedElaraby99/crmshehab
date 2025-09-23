const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Product');
const ProductPurchase = require('../models/ProductPurchase');
const { authenticateUser, authenticateVendor, authenticateUserOrVendor } = require('../middleware/auth');

const router = express.Router();

// Multer storage for order item images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save into backend/upload (served at /upload)
    cb(null, path.join(__dirname, '..', 'upload'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP allowed'));
  }
});

// Get all orders
router.get('/', authenticateUserOrVendor, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      searchType = 'all',
      status,
      vendorId,
      sortBy = 'orderDate',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };

    if (search) {
      switch (searchType) {
        case 'invoiceNumber':
          query.invoiceNumber = { $regex: search, $options: 'i' };
          break;
        case 'itemCount':
          // For item count search, we need to use aggregation or find orders with specific item count
          const itemCount = parseInt(search);
          if (!isNaN(itemCount)) {
            // This will be handled after the query by filtering results
            query._itemCountFilter = itemCount;
          }
          break;
        case 'all':
        default:
          query.$or = [
            { orderNumber: { $regex: search, $options: 'i' } },
            { 'items.itemNumber': { $regex: search, $options: 'i' } },
            { invoiceNumber: { $regex: search, $options: 'i' } },
            { notes: { $regex: search, $options: 'i' } }
          ];
          break;
      }
    }

    if (status) {
      query.status = status;
    }

    if (vendorId) {
      query.vendorId = vendorId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    let orders = await Order.find(query)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate([
        { path: 'vendorId', select: 'name contactPerson email' },
        { path: 'items.productId', select: 'name itemNumber' }
      ]);

    // Filter by item count if needed
    if (query._itemCountFilter) {
      orders = orders.filter(order => order.items.length === query._itemCountFilter);
    }

    const total = await Order.countDocuments({ ...query, _itemCountFilter: undefined });

    res.json({
      success: true,
      data: orders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Create order
router.post('/', [
  authenticateUserOrVendor,
  body('vendorId').isMongoId().withMessage('Valid vendor ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').isMongoId().withMessage('Valid product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
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

    const { vendorId, items, shippingAddress, notes, expectedDeliveryDate, orderNumber: providedOrderNumber, confirmFormShehab } = req.body;

    // Use provided order number or generate one
    const orderNumber = providedOrderNumber || `ORD-${String(Date.now()).slice(-6)}`;

    // Do not calculate or require prices on creation
    let totalAmount = undefined;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.productId} not found`
        });
      }

      processedItems.push({
        productId: item.productId,
        itemNumber: product.itemNumber,
        quantity: item.quantity
      });
    }

    const order = new Order({
      orderNumber,
      vendorId,
      items: processedItems,
      totalAmount,
      shippingAddress,
      notes,
      expectedDeliveryDate,
      confirmFormShehab
    });

    await order.save();
    await order.populate([
      { path: 'vendorId', select: 'name contactPerson email' },
      { path: 'items.productId', select: 'name itemNumber' }
    ]);

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update order
router.put('/:id', [
  authenticateUserOrVendor,
  body('status').optional().isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid status'),
  body('priceApprovalStatus').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid price approval status'),
  body('confirmFormShehab').optional().trim().isLength({ max: 500 }).withMessage('Confirmation form too long'),
  body('estimatedDateReady').optional().trim().isLength({ max: 100 }).withMessage('Estimated date too long'),
  body('invoiceNumber').optional().trim().isLength({ max: 100 }).withMessage('Invoice number too long'),
  body('transferAmount').optional().isNumeric().withMessage('Transfer amount must be a number'),
  body('shippingDateToAgent').optional().trim().isLength({ max: 100 }).withMessage('Shipping date too long'),
  body('shippingDateToSaudi').optional().trim().isLength({ max: 100 }).withMessage('Shipping date too long'),
  body('arrivalDate').optional().trim().isLength({ max: 100 }).withMessage('Arrival date too long'),
  body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const order = await Order.findById(req.params.id);
    if (!order || !order.isActive) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // If user is a vendor, ensure they can only update their own orders
    if (req.userType === 'vendor' && order.vendorId.toString() !== req.vendor._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only update your own orders.' });
    }

    const previousStatus = order.status;
    const updateData = {};

    if (req.body.status) updateData.status = req.body.status;

    // Only allow priceApprovalStatus to be changed by admins, not vendors
    if (req.body.priceApprovalStatus !== undefined) {
      if (req.userType === 'admin') {
        updateData.priceApprovalStatus = req.body.priceApprovalStatus;
      } else {
        const currentOrder = await Order.findById(req.params.id);
        if (currentOrder) {
          updateData.priceApprovalStatus = currentOrder.priceApprovalStatus;
        }
      }
    }

    // Apply updates
    await Order.findByIdAndUpdate(req.params.id, updateData, { runValidators: true });

    // Adjust stock and create/remove purchase records if needed
    const newStatus = updateData.status || previousStatus;
    const isNowConfirmed = newStatus === 'confirmed';
    const leftConfirmed = previousStatus === 'confirmed' && newStatus !== 'confirmed';

    if (isNowConfirmed && !order.stockAdjusted) {
      // Increase stock for each item
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
      }
      // Create purchase records
      const populatedVendor = await Order.findById(order._id).populate({ path: 'vendorId', select: 'name' });
      const vendorName = populatedVendor?.vendorId?.name || 'Unknown';
      const now = new Date();
      for (const item of order.items) {
        const price = typeof item.unitPrice === 'number' ? item.unitPrice : 0;
        const totalAmount = price * (item.quantity || 0);
        await ProductPurchase.create({
          productId: item.productId,
          vendorId: order.vendorId,
          vendorName,
          quantity: item.quantity,
          price,
          totalAmount,
          purchaseDate: now,
          orderId: order._id,
          notes: order.notes || ''
        });
      }
      order.stockAdjusted = true;
      await order.save();
    } else if (leftConfirmed && order.stockAdjusted) {
      // Rollback stock for each item
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
      }
      // Remove purchase records for this order
      await ProductPurchase.deleteMany({ orderId: order._id });
      order.stockAdjusted = false;
      await order.save();
    }

    // Fetch the final updated order
    const updatedOrder = await Order.findById(req.params.id).populate([
      { path: 'vendorId', select: 'name contactPerson email' },
      { path: 'items.productId', select: 'name itemNumber' }
    ]);

    res.json({ success: true, message: 'Order updated successfully', data: updatedOrder });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Delete order (soft delete)
router.delete('/:id', authenticateUserOrVendor, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order || !order.isActive) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // If user is a vendor, ensure they can only delete their own orders
    if (req.userType === 'vendor' && order.vendorId.toString() !== req.vendor._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied. You can only delete your own orders.' });
    }

    await Order.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });

    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get vendor orders
router.get('/vendor/:vendorId', authenticateVendor, async (req, res) => {
  try {
    const { vendorId } = req.params;
    const orders = await Order.find({ vendorId, isActive: true })
      .sort({ orderDate: -1 })
      .populate([
        { path: 'vendorId', select: 'name contactPerson email' },
        { path: 'items.productId', select: 'name itemNumber' }
      ]);

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Get vendor orders error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
