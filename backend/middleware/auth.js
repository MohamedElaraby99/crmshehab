const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

// Middleware to authenticate user
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Middleware to authenticate vendor
const authenticateVendor = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = verifyToken(token);
    const vendor = await Vendor.findById(decoded.vendorId).select('-password');
    
    if (!vendor || !vendor.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or vendor not found.'
      });
    }

    req.vendor = vendor;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Middleware to authenticate either user or vendor
const authenticateUserOrVendor = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = verifyToken(token);
    
    // Check if it's a user token
    if (decoded.userId) {
      const user = await User.findById(decoded.userId).select('-password');
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token or user not found.'
        });
      }
      req.user = user;
      req.userType = user.role; // Set userType based on user's role (admin or vendor)
    }
    // Check if it's a vendor token
    else if (decoded.vendorId) {
      const vendor = await Vendor.findById(decoded.vendorId).select('-password');
      if (!vendor || !vendor.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token or vendor not found.'
        });
      }
      req.vendor = vendor;
      req.userType = 'vendor';
    }
    else {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format.'
      });
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// Middleware to check if user is supplier
const requireSupplier = (req, res, next) => {
  if (req.user.role !== 'supplier' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Supplier privileges required.'
    });
  }
  next();
};

module.exports = {
  generateToken,
  verifyToken,
  authenticateUser,
  authenticateVendor,
  authenticateUserOrVendor,
  requireAdmin,
  requireSupplier
};
