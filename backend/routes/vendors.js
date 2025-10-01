const express = require('express');
const { body, validationResult } = require('express-validator');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const { authenticateUser, authenticateVendor, authenticateUserOrVendor, requireAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Get all vendors
router.get('/', authenticateUser, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const query = { isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    const vendors = await Vendor.find(query)
      .populate({
        path: 'userId',
        select: 'username',
        match: { isActive: true }
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vendor.countDocuments(query);

    console.log('GET vendors - found vendors:', vendors.length, 'total:', total);

    res.json({
      success: true,
      data: vendors,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get vendor by ID
router.get('/:id', authenticateUserOrVendor, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
      .populate('userId', 'username');

    if (!vendor || !vendor.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // If user is a vendor, ensure they can only access their own data
    if (req.userType === 'vendor' && vendor._id.toString() !== req.vendor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own vendor information.'
      });
    }

    res.json({
      success: true,
      data: vendor
    });
  } catch (error) {
    console.error('Get vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create vendor
router.post('/', [
  authenticateUser,
  requireAdmin,
  body('name').trim().isLength({ min: 1 }).withMessage('Name is required'),
  body('contactPerson').optional().trim(),
  body('email').optional().custom((value) => {
    if (value && value.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error('Valid email format required');
      }
    }
    return true;
  }),
  body('phone').optional().trim(),
  body('address').optional().trim(),
  body('city').optional().trim(),
  body('country').optional().trim()
], async (req, res) => {
  try {
    console.log('Vendor creation request received:', req.body);
    console.log('User making request:', req.user);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, contactPerson, email, phone, address, city, country, status = 'active' } = req.body;

    // Check if email already exists (only when provided)
    if (email && email.trim() !== '') {
      const existingVendor = await Vendor.findOne({ email });
      if (existingVendor) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Generate username and password
    const username = name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20) + '_' + Date.now().toString().slice(-4);

    const password = generateSecurePassword();

    // Create user account
    console.log('Creating user with:', { username, password: '***', role: 'vendor' });
    const user = new User({
      username,
      password,
      role: 'vendor',
      isSupplier: false
    });

    await user.save();
    console.log('User created successfully:', user._id);
    
    // Verify user was created and is active
    const createdUser = await User.findById(user._id);
    if (!createdUser || !createdUser.isActive) {
      throw new Error('User creation failed or user is not active');
    }

    // Create vendor
    const vendor = new Vendor({
      name,
      contactPerson,
      email,
      phone,
      address,
      city,
      country,
      status,
      username,
      password,
      userId: user._id
    });

    await vendor.save();

    console.log('Vendor created successfully:', vendor);
    res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
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
          password: vendor.password,
          createdAt: vendor.createdAt,
          updatedAt: vendor.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update vendor (admin)
router.put('/:id', [
  authenticateUser,
  requireAdmin,
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Name cannot be empty'),
  body('contactPerson').optional().trim().isLength({ min: 1 }).withMessage('Contact person cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('phone').optional().trim().isLength({ min: 1 }).withMessage('Phone cannot be empty'),
  body('address').optional().trim().isLength({ min: 1 }).withMessage('Address cannot be empty'),
  body('city').optional().trim().isLength({ min: 1 }).withMessage('City cannot be empty'),
  body('country').optional().trim().isLength({ min: 1 }).withMessage('Country cannot be empty'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status')
], async (req, res) => {
  try {
    console.log('Update vendor request:', { id: req.params.id, body: req.body });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor || !vendor.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Check if email is being changed and if it already exists
    if (req.body.email && req.body.email !== vendor.email) {
      const existingVendor = await Vendor.findOne({ email: req.body.email });
      if (existingVendor) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    // Filter out fields that shouldn't be updated directly
    const allowedFields = ['name', 'contactPerson', 'email', 'phone', 'address', 'city', 'country', 'status'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    console.log('Update data:', updateData);

    const updatedVendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Vendor updated successfully',
      data: updatedVendor
    });
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update vendor (by vendor)
router.put('/vendor/:id', [
  authenticateVendor,
  body('contactPerson').optional().trim().isLength({ min: 1 }).withMessage('Contact person cannot be empty'),
  body('phone').optional().trim().isLength({ min: 1 }).withMessage('Phone cannot be empty'),
  body('address').optional().trim().isLength({ min: 1 }).withMessage('Address cannot be empty'),
  body('city').optional().trim().isLength({ min: 1 }).withMessage('City cannot be empty'),
  body('country').optional().trim().isLength({ min: 1 }).withMessage('Country cannot be empty')
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

    // Check if vendor is updating their own profile
    if (req.vendor._id.toString() !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own profile.'
      });
    }

    const allowedFields = ['contactPerson', 'phone', 'address', 'city', 'country'];
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const updatedVendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedVendor
    });
  } catch (error) {
    console.error('Update vendor profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete vendor (soft delete)
router.delete('/:id', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // Also deactivate the associated user
    if (vendor.userId) {
      await User.findByIdAndUpdate(vendor.userId, { isActive: false });
    }

    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Generate secure password
function generateSecurePassword() {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  // Ensure at least one character from each category
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
  password += "0123456789"[Math.floor(Math.random() * 10)];
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Update vendor credentials (username and password)
router.put('/:id/credentials', [
  authenticateUser,
  requireAdmin,
  body('username').optional().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    console.log('Update vendor credentials request:', { id: req.params.id, body: req.body });
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor || !vendor.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const updateData = {};
    
    // Update username if provided
    if (req.body.username) {
      // Check if username is already taken by another vendor
      const existingVendor = await Vendor.findOne({ 
        username: req.body.username, 
        _id: { $ne: req.params.id },
        isActive: true 
      });
      
      if (existingVendor) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
      
      updateData.username = req.body.username;
    }
    
    // Update password if provided
    if (req.body.password) {
      updateData.password = req.body.password;
    }
    
    // If no updates provided
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid updates provided'
      });
    }

    // Update the vendor
    const updatedVendor = await Vendor.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password'); // Don't return password in response

    console.log('Vendor credentials updated successfully');
    
    res.json({
      success: true,
      message: 'Vendor credentials updated successfully',
      data: updatedVendor
    });
  } catch (error) {
    console.error('Update vendor credentials error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Vendor heartbeat (online presence)
router.post('/me/heartbeat', authenticateVendor, async (req, res) => {
  try {
    await Vendor.findByIdAndUpdate(req.vendor._id, { lastOnlineAt: new Date() }, { new: false });
    // Optional: broadcast presence via socket
    try {
      const io = req.app.get('io');
      if (io) io.emit('vendors:presence', { id: String(req.vendor._id), lastOnlineAt: new Date().toISOString() });
    } catch {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Vendor set offline explicitly (e.g., on logout/close)
router.post('/me/offline', authenticateVendor, async (req, res) => {
  try {
    await Vendor.findByIdAndUpdate(req.vendor._id, { lastOnlineAt: null }, { new: false });
    try {
      const io = req.app.get('io');
      if (io) io.emit('vendors:presence', { id: String(req.vendor._id), lastOnlineAt: null });
    } catch {}
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Vendor marks orders table as read
router.post('/me/orders/last-read', authenticateVendor, async (req, res) => {
  try {
    const ts = new Date();
    await Vendor.findByIdAndUpdate(req.vendor._id, { lastOrdersReadAt: ts }, { new: false });
    try {
      const io = req.app.get('io');
      if (io) io.emit('vendors:lastRead', { id: String(req.vendor._id), lastOrdersReadAt: ts.toISOString() });
    } catch {}
    res.json({ success: true, data: { lastOrdersReadAt: ts.toISOString() } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin: list vendor presence/read status
router.get('/presence/list', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const vendors = await Vendor.find({ isActive: true }).select('name contactPerson lastOnlineAt lastOrdersReadAt');
    res.json({ success: true, data: vendors });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
