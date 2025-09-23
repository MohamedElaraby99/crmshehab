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

    const demand = await Demand.create({ productId, userId: req.user._id, quantity, notes });
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

    const list = await Demand.find().sort({ createdAt: -1 }).populate('productId', 'name itemNumber');
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('List demands error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
