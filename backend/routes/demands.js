const express = require('express');
const { body, validationResult } = require('express-validator');
const Demand = require('../models/Demand');
const Product = require('../models/Product');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Create demand (client)
router.post('/', [
  authenticateUser,
  body('productId').isMongoId().withMessage('Valid productId is required'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('quantity must be >= 1'),
  body('notes').optional().isString().isLength({ max: 500 }).withMessage('notes too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { productId, quantity = 1, notes } = req.body;

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const demand = await Demand.create({ productId, userId: req.user._id, quantity, notes, status: 'pending' });
    // Socket notifications for admins
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('demands:created', {
          id: demand._id,
          productId,
          userId: req.user._id,
          quantity,
          notes,
          createdAt: demand.createdAt
        });
        io.emit('notifications:push', {
          type: 'demand_created',
          demandId: demand._id,
          productId,
          message: `New demand created (qty ${quantity})`,
          at: new Date().toISOString()
        });
      }
    } catch {}
    res.status(201).json({ success: true, data: demand });
  } catch (error) {
    console.error('Create demand error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// List demands (admin only)
router.get('/', authenticateUser, async (req, res) => {
  try {
    // Only admins can list all demands
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const list = await Demand.find()
      .sort({ createdAt: -1 })
      .populate('productId', 'name itemNumber')
      .populate('userId', 'username');
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('List demands error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// List current user's demands (client/vendor)
router.get('/mine', authenticateUser, async (req, res) => {
  try {
    const list = await Demand.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('productId', 'name itemNumber');
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('List my demands error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update demand status (admin)
router.put('/:id/status', authenticateUser, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { status } = req.body;
    if (!['pending', 'confirmed', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    // Find existing for previous status and details
    const existing = await Demand.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Demand not found' });

    // Track previous status, then update
    const prevStatus = existing.status;
    existing.status = status;
    await existing.save();
    const demand = await Demand.findById(existing._id).populate('productId', 'name itemNumber').populate('userId', 'username');
    if (!demand) return res.status(404).json({ success: false, message: 'Demand not found' });

    // Adjust product stock on confirmation transitions
    try {
      const Product = require('../models/Product');
      // Reduce stock when moving into confirmed
      if (status === 'confirmed' && prevStatus !== 'confirmed' && existing.productId) {
        await Product.findByIdAndUpdate(existing.productId, { $inc: { stock: -(existing.quantity || 0) } });
      }
      // Optional rollback: if moving out of confirmed, restore stock
      if (prevStatus === 'confirmed' && status !== 'confirmed' && existing.productId) {
        await Product.findByIdAndUpdate(existing.productId, { $inc: { stock: (existing.quantity || 0) } });
      }
    } catch (e) {
      console.error('Demand stock adjustment error:', e);
    }

    // Emit socket events
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('demands:updated', demand);
        io.emit('notifications:push', {
          type: 'demand_' + status,
          demandId: demand._id,
          message: `Demand ${status}`,
          at: new Date().toISOString()
        });
        // Also notify product updates for client/admin views
        const pid = demand && demand.productId && demand.productId._id ? demand.productId._id : demand.productId;
        io.emit('products:updated', { id: pid });
      }
    } catch {}

    return res.json({ success: true, data: demand });
  } catch (error) {
    console.error('Update demand status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
