const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { generateToken, authenticateUser, authenticateVendor, authenticateUserOrVendor } = require('../middleware/auth');

const router = express.Router();

// User login
router.post('/login', [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
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

    const { username, password } = req.body;
    console.log('[AUTH] Login attempt:', { username });

    // Find user by username (regardless of active), then handle activation logic
    let user = await User.findOne({ username });
    console.log('[AUTH] User found/active:', !!user, user?.isActive);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    console.log('[AUTH] Password match:', isPasswordValid);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // If user is inactive but credentials are correct, reactivate on login
    if (!user.isActive) {
      user.isActive = true;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken({
      userId: user._id,
      username: user.username,
      role: user.role,
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Reactivate deactivated user (with valid credentials)
router.post('/reactivate', [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { username, password } = req.body;

    // Find even if inactive
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Reactivate
    user.isActive = true;
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({
      userId: user._id,
      username: user.username,
      role: user.role,
    });

    return res.json({ success: true, message: 'Account reactivated', data: { user: user.toJSON(), token } });
  } catch (error) {
    console.error('Reactivate error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Vendor login
router.post('/vendor-login', [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
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

    const { username, password } = req.body;

    // Find vendor by username
    const vendor = await Vendor.findOne({ username, isActive: true });
    if (!vendor) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = vendor.password === password; // For demo purposes
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken({
      vendorId: vendor._id,
      username: vendor.username,
      role: 'vendor'
    });

    res.json({
      success: true,
      message: 'Vendor login successful',
      data: {
        vendor: {
          id: vendor._id,
          name: vendor.name,
          contactPerson: vendor.contactPerson,
          email: vendor.email,
          phone: vendor.phone,
          address: vendor.address,
          city: vendor.city,
          country: vendor.country,
          status: vendor.status,
          username: vendor.username,
          createdAt: vendor.createdAt,
          updatedAt: vendor.updatedAt
        },
        token
      }
    });
  } catch (error) {
    console.error('Vendor login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get current user or vendor
router.get('/me', authenticateUserOrVendor, async (req, res) => {
  // Return user if it's a user token, vendor if it's a vendor token
  if (req.user) {
    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } else if (req.vendor) {
    res.json({
      success: true,
      data: {
        vendor: req.vendor
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// Get current vendor
router.get('/vendor-me', authenticateVendor, async (req, res) => {
  res.json({
    success: true,
    data: {
      vendor: req.vendor
    }
  });
});

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

module.exports = router;
