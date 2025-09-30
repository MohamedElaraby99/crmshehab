const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateUser } = require('../middleware/auth');
const WhatsAppRecipient = require('../models/WhatsAppRecipient');

const router = express.Router();

// List recipients (admin only)
router.get('/', authenticateUser, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const list = await WhatsAppRecipient.find().sort({ createdAt: -1 });
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('List WhatsApp recipients error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Create recipient (admin only)
router.post('/', [
  authenticateUser,
  body('phone').trim().isLength({ min: 5 }).withMessage('Phone is required'),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name too long'),
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }
    const { phone, name } = req.body;
    const created = await WhatsAppRecipient.create({ phone, name: name || '' });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Create WhatsApp recipient error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Delete recipient (admin only)
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const deleted = await WhatsAppRecipient.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Recipient not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete WhatsApp recipient error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;


