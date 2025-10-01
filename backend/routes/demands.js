const express = require('express');
const { body, validationResult } = require('express-validator');
const Demand = require('../models/Demand');
const Product = require('../models/Product');
const { authenticateUser } = require('../middleware/auth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Get confirmed demands for a specific product (admin)
router.get('/product/:productId/confirmed', authenticateUser, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { productId } = req.params;
    const list = await Demand.find({ productId, status: 'confirmed' })
      .sort({ createdAt: -1 })
      .populate('userId', 'username')
      .populate('productId', 'name itemNumber sellingPrice');
    res.json({ success: true, data: list });
  } catch (error) {
    console.error('Get confirmed demands by product error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

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

    // Adjust product stock on confirmation transitions (allow confirm even if out of stock)
    try {
      const Product = require('../models/Product');
      // Reduce stock when moving into confirmed
      if (status === 'confirmed' && prevStatus !== 'confirmed' && existing.productId) {
        const product = await Product.findById(existing.productId);
        if (!product || !product.isActive) {
          return res.status(404).json({ success: false, message: 'Product not found' });
        }
        const qty = existing.quantity || 0;
        // Atomic decrement to avoid race conditions
        await Product.findByIdAndUpdate(existing.productId, { $inc: { stock: -qty } });
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

// Send WhatsApp report for a demand (admin)
router.post('/:id/send-report', [
  authenticateUser,
  body('recipientPhone').trim().isLength({ min: 5 }).withMessage('recipientPhone is required'),
  body('bundleWindowSec').optional().isInt({ min: 0, max: 600 })
], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const demand = await Demand.findById(req.params.id).populate('productId', 'name itemNumber sellingPrice').populate('userId', 'username');
    if (!demand) return res.status(404).json({ success: false, message: 'Demand not found' });

    const bundleWindowSec = Number(req.body.bundleWindowSec || 60);
    const userId = demand.userId && demand.userId._id ? String(demand.userId._id) : String(demand.userId);
    const ts = new Date(demand.createdAt).getTime();
    const startTs = ts - bundleWindowSec * 1000;
    const endTs = ts + bundleWindowSec * 1000;
    const nearby = await Demand.find({
      userId,
      createdAt: { $gte: new Date(startTs), $lte: new Date(endTs) }
    }).populate('productId', 'name itemNumber sellingPrice');

    const list = (nearby && nearby.length ? nearby : [demand]).map((dm) => {
      const pr = dm.productId || {};
      const price = typeof pr.sellingPrice === 'number' ? pr.sellingPrice : 0;
      return {
        item: pr.itemNumber || '',
        name: pr.name || '',
        qty: dm.quantity || 0,
        price,
      };
    });
    const total = list.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 0)), 0);

    const lines = [
      'Demand Report',
      `Date: ${new Date(demand.createdAt).toLocaleString()}`,
      `User: ${demand.userId && demand.userId.username ? demand.userId.username : userId}`,
      '',
      'Items:',
      ...list.map(it => `- ${it.item} • ${it.name} • x${it.qty} • $${Number(it.price || 0).toFixed(2)}`),
      '',
      `Total (est): $${total.toFixed(2)}`,
      `Notes: ${demand.notes || '—'}`
    ];
    const textContent = lines.join('\n');

    // Write HTML report to /upload and provide a public link
    const uploadDir = path.join(__dirname, '..', 'upload');
    try { if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }); } catch {}
    const fileBase = `demand_${String(demand._id)}_${Date.now()}`;
    const htmlPath = path.join(uploadDir, `${fileBase}.html`);
    const safeHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Demand Report</title></head><body><pre style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; white-space: pre-wrap;">${lines.map(l => String(l).replace(/</g, '&lt;').replace(/>/g, '&gt;')).join('\n')}</pre></body></html>`;
    fs.writeFileSync(htmlPath, safeHtml, 'utf8');

    // Build public URL (served by /upload static)
    const baseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
    const reportUrl = baseUrl ? `${baseUrl}/upload/${path.basename(htmlPath)}` : `/upload/${path.basename(htmlPath)}`;

    // Send via WhatsApp Cloud API (text with link)
    const WA_TOKEN = process.env.WHATSAPP_TOKEN;
    const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!WA_TOKEN || !WA_PHONE_ID) {
      return res.status(500).json({ success: false, message: 'WhatsApp not configured (missing env)' });
    }

    const recipientPhone = String(req.body.recipientPhone).replace(/[^\d]/g, '');
    const apiUrl = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`;

    const messageText = `${textContent}\n\nReport link: ${reportUrl}`;
    const payload = {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'text',
      text: { body: messageText }
    };

    const waResp = await axios.post(apiUrl, payload, {
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000,
      validateStatus: () => true
    });

    if (waResp.status >= 200 && waResp.status < 300) {
      return res.json({ success: true, data: { reportUrl } });
    } else {
      return res.status(waResp.status || 500).json({ success: false, message: 'WhatsApp send failed', details: waResp.data });
    }
  } catch (error) {
    console.error('Send WhatsApp report error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
