const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const ProductPurchase = require('../models/ProductPurchase');
const Order = require('../models/Order');
const { authenticateUser, requireAdmin, authenticateUserOrVendor } = require('../middleware/auth');
const fs = require('fs');
const os = require('os');
// Use built-in fetch on Node >=18, fallback to dynamic import
const getFetch = async () => {
  if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis);
  const mod = await import('node-fetch');
  return mod.default;
};
let xlsx; // lazy require to avoid startup cost

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

// Increase limits later for Excel import; default image limit stays moderate
const productUpload = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP allowed'));
  }
});

// Separate multer for large Excel uploads (up to 200 MB)
const excelUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'upload')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '')}`)
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype) || /\.(xlsx|xls|csv)$/i.test(file.originalname)) cb(null, true); else cb(new Error('Only Excel/CSV files are allowed'));
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
router.get('/', authenticateUserOrVendor, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { isActive: true };

    // Note: Vendors and admins can see all products without the visibleToClients filter

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { itemNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build select fields based on user type
    let selectFields = 'itemNumber name description images specifications isActive createdAt updatedAt reorderLevel visibleToClients';
    if (req.userType !== 'vendor' && req.user?.role !== 'vendor') {
      // Non-vendor users can see stock and selling price
      selectFields += ' sellingPrice stock';
    }

    const products = await Product.find(query)
      .select(selectFields)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Product.countDocuments(query);

    // Normalize and backfill stock only if stock is not set (do not override 0)
    // For vendors, don't include stock information
    const normalized = await Promise.all(products.map(async (p) => {
      const obj = normalizeProduct(p);
      if ((req.userType !== 'vendor' && req.user?.role !== 'vendor') && (obj.stock === undefined || obj.stock === null)) {
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

// Visible products endpoint (separate endpoint)
router.get('/visible/list', authenticateUserOrVendor, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let query = { isActive: true };

    // Note: Vendors and admins can see all products without the visibleToClients filter

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { itemNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Build select fields based on user type
    let selectFields = 'itemNumber name description images specifications isActive createdAt updatedAt reorderLevel visibleToClients';
    if (req.userType !== 'vendor' && req.user?.role !== 'vendor') {
      // Non-vendor users can see stock and selling price
      selectFields += ' sellingPrice stock';
    }

    const products = await Product.find(query)
      .select(selectFields)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Product.countDocuments(query);

    // Normalize and backfill stock only if stock is not set (match admin behavior)
    // For vendors, don't include stock information
    const normalized = await Promise.all(products.map(async (p) => {
      const obj = normalizeProduct(p);
      if ((req.userType !== 'vendor' && req.user?.role !== 'vendor') && (obj.stock === undefined || obj.stock === null)) {
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

    // Build select fields based on user type
    let selectFields = 'itemNumber name description images specifications isActive createdAt updatedAt reorderLevel visibleToClients';
    if (req.userType !== 'vendor' && req.user?.role !== 'vendor') {
      // Non-vendor users can see stock and selling price
      selectFields += ' sellingPrice stock';
    }

    const products = await Product.find(query)
      .select(selectFields)
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Product.countDocuments(query);

    // Normalize and backfill stock only if stock is not set (match admin behavior)
    // For vendors, don't include stock information
    const normalized = await Promise.all(products.map(async (p) => {
      const obj = normalizeProduct(p);
      if ((req.userType !== 'vendor' && req.user?.role !== 'vendor') && (obj.stock === undefined || obj.stock === null)) {
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
    console.error('Get visible products (alias) error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin-triggered export to external application
router.post('/export/send', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const {
      targetUrl,
      includeHidden = true,
      dryRun = false,
      limit,
    } = req.body || {};

    const destinationUrl = targetUrl || process.env.EXTERNAL_PRODUCTS_WEBHOOK_URL;
    if (!destinationUrl && !dryRun) {
      return res.status(400).json({
        success: false,
        message: 'Provide `targetUrl` in the request body or configure EXTERNAL_PRODUCTS_WEBHOOK_URL.',
      });
    }

    const numericLimit = Math.min(
      Math.max(parseInt(limit, 10) || 0, 0),
      5000
    );

    const query = { isActive: true };
    if (!includeHidden) {
      query.visibleToClients = true;
    }

    let productQuery = Product.find(query).sort({ updatedAt: -1 });
    if (numericLimit > 0) {
      productQuery = productQuery.limit(numericLimit);
    }

    const docs = await productQuery.lean();
    const normalized = docs.map(normalizeProduct);
    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        total: normalized.length,
        includeHidden: !!includeHidden,
        limited: numericLimit > 0 && normalized.length >= numericLimit,
      },
      products: normalized,
    };

    let remoteResponse = null;
    if (!dryRun) {
      const fetch = await getFetch();
      const controller = new AbortController();
      const timeoutMs = Number(process.env.EXTERNAL_PRODUCTS_WEBHOOK_TIMEOUT_MS || 10000);
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const resp = await fetch(destinationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'crm-products-export/1.0',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const text = await resp.text();
        let parsedBody = null;
        try {
          parsedBody = JSON.parse(text);
        } catch {
          parsedBody = text;
        }
        remoteResponse = {
          status: resp.status,
          ok: resp.ok,
          body: parsedBody,
        };
        if (!resp.ok) {
          return res.status(502).json({
            success: false,
            message: `External app responded with status ${resp.status}`,
            data: { remoteResponse, destinationUrl },
          });
        }
      } catch (error) {
        const isAbort = error?.name === 'AbortError';
        console.error('Failed to reach external app webhook:', error);
        return res.status(502).json({
          success: false,
          message: isAbort ? 'Timed out while contacting external app' : 'Failed to contact external app',
          data: { destinationUrl },
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }

    res.json({
      success: true,
      message: dryRun ? 'Dry run complete. No payload was sent.' : 'Products sent to external app successfully.',
      data: {
        meta: payload.meta,
        remoteResponse,
        destinationUrl: dryRun ? null : destinationUrl,
        preview: normalized.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Export products to external app error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// API key protected export for external consumers
router.get('/export/share', async (req, res) => {
  try {
    const expectedKey = (process.env.EXTERNAL_PRODUCTS_API_KEY || '').trim();
    if (!expectedKey) {
      return res.status(503).json({
        success: false,
        message: 'External products API key is not configured on the server.',
      });
    }

    const providedKey = String(
      req.headers['x-external-api-key'] ||
      req.headers['x-api-key'] ||
      req.query.key ||
      ''
    ).trim();

    if (!providedKey || providedKey !== expectedKey) {
      return res.status(401).json({
        success: false,
        message: 'Invalid external API key.',
      });
    }

    const includeHidden = String(req.query.includeHidden || 'false').toLowerCase() === 'true';
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 1000, 1),
      5000
    );

    const query = { isActive: true };
    if (!includeHidden) {
      query.visibleToClients = true;
    }

    const docs = await Product.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    const normalized = docs.map(normalizeProduct);

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        products: normalized,
        meta: {
          exportedAt: new Date().toISOString(),
          total: normalized.length,
          includeHidden,
          limit,
        },
      },
    });
  } catch (error) {
    console.error('External share endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// Public endpoint for external applications (no authentication required)
router.get('/public', async (req, res) => {
  try {
    const includeHidden = String(req.query.includeHidden || 'false').toLowerCase() === 'true';
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 1000, 1),
      5000
    );

    const query = { isActive: true };
    if (!includeHidden) {
      query.visibleToClients = true;
    }

    // Fetch all product fields including stock
    const docs = await Product.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    // Normalize products and compute stock if needed
    const normalized = await Promise.all(docs.map(async (p) => {
      const obj = normalizeProduct(p);
      // Ensure stock is always present - compute from confirmed orders if not set
      if (obj.stock === undefined || obj.stock === null || isNaN(obj.stock)) {
        obj.stock = await computeStockFromConfirmed(obj.id);
      }
      // Ensure stock is a number
      obj.stock = typeof obj.stock === 'number' ? obj.stock : 0;
      return obj;
    }));

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: {
        products: normalized,
        meta: {
          exportedAt: new Date().toISOString(),
          total: normalized.length,
          includeHidden,
          limit,
        },
      },
    });
  } catch (error) {
    console.error('Public products endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
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
    if (obj.stock === undefined || obj.stock === null) {
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
  authenticateUserOrVendor,
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

    // Always provide a description: Use provided description, or generate from name + itemNumber, or just name
    let finalDescription = description;
    if (!finalDescription || finalDescription.trim() === '') {
      if (name !== itemNumber) {
        finalDescription = `${name} (${itemNumber})`;
      } else {
        finalDescription = name;
      }
    }

    // Check if item number already exists
    const existingProduct = await Product.findOne({ itemNumber });
    if (existingProduct) {
      // If an inactive product with same itemNumber exists, reactivate/update it instead of erroring
      if (existingProduct.isActive === false) {
        existingProduct.name = name;
        // Always ensure description is set
        existingProduct.description = finalDescription;
        if (typeof specifications !== 'undefined') existingProduct.specifications = specifications || {};
        if (typeof sellingPrice !== 'undefined') existingProduct.sellingPrice = sellingPrice;
        if (typeof stock !== 'undefined') existingProduct.stock = stock;
        if (typeof visibleToClients !== 'undefined') existingProduct.visibleToClients = visibleToClients;
        if (typeof reorderLevel !== 'undefined') existingProduct.reorderLevel = reorderLevel;
        existingProduct.isActive = true;
        await existingProduct.save();
        return res.status(200).json({
          success: true,
          message: 'Existing product reactivated and updated',
          data: normalizeProduct(existingProduct)
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Item number already exists'
      });
    }

    const product = new Product({
      itemNumber,
      name,
      description: finalDescription,
      specifications: specifications || {},
      ...(typeof sellingPrice !== 'undefined' ? { sellingPrice } : {}),
      ...(typeof stock !== 'undefined' ? { stock } : {}),
      ...(typeof visibleToClients !== 'undefined' ? { visibleToClients } : {}),
      ...(typeof reorderLevel !== 'undefined' ? { reorderLevel } : {})
    });

    await product.save();

    // Emit socket event for product creation
    try {
      const io = req.app.get('io');
      if (io) io.emit('products:created', normalizeProduct(product));
    } catch {}

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
  authenticateUserOrVendor,
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

    // Prepare update data
    const updateData = { ...req.body };
    
    // If description is provided and empty, generate one from name and itemNumber
    if ('description' in req.body) {
      const providedDescription = String(req.body.description || '').trim();
      if (providedDescription === '') {
        const productName = req.body.name || product.name;
        const productItemNumber = req.body.itemNumber || product.itemNumber;
        if (productName !== productItemNumber) {
          updateData.description = `${productName} (${productItemNumber})`;
        } else {
          updateData.description = productName;
        }
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    const obj = normalizeProduct(updatedProduct);
    if (!obj.stock || obj.stock === 0) {
      obj.stock = await computeStockFromConfirmed(obj.id);
    }
    // Ensure visibleToClients is present in response
    obj.visibleToClients = typeof obj.visibleToClients === 'boolean' ? obj.visibleToClients : true;

    // Emit socket event for product update
    try {
      const io = req.app.get('io');
      if (io) io.emit('products:updated', obj);
    } catch {}

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
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const deletedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    try {
      const io = req.app.get('io');
      if (io) io.emit('products:deleted', { id: req.params.id });
    } catch {}

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
router.post('/:id/image', [authenticateUserOrVendor, productUpload.single('image')], async (req, res) => {
  try {
    if (!req.user && !req.vendor) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // For vendor users, ensure they can only upload images for their own products
    if (req.userType === 'vendor' || (req.user && req.user.role === 'vendor')) {
      const vendorId = req.vendor?.id || req.user?.id;
      if (product.vendorId && product.vendorId.toString() !== vendorId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only upload images for your own products'
        });
      }
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

// Import products from Excel/CSV
router.post('/import/excel', [authenticateUser, requireAdmin, excelUpload.single('file')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Lazy require xlsx to keep cold start fast
    if (!xlsx) xlsx = require('xlsx');

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath, { cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Read as array-of-arrays to locate the header row reliably
    const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const headerKeywords = ['oem', 'item number', 'part number'];
    let headerIndex = -1;
    for (let i = 0; i < Math.min(aoa.length, 20); i++) {
      const row = aoa[i] || [];
      const tokens = row.map(norm).filter(Boolean);
      if (tokens.length === 0) continue;
      const hasKey = headerKeywords.some(k => tokens.some(t => t.includes(k)));
      const hasQty = tokens.some(t => t.includes('quantity') || t.includes('qty'));
      if (hasKey && hasQty) { headerIndex = i; break; }
    }

    if (headerIndex === -1) {
      // Fallback to first non-empty row
      headerIndex = aoa.findIndex(r => (r || []).some(c => String(c).trim() !== ''));
      if (headerIndex === -1) headerIndex = 0;
    }

    const headerRow = (aoa[headerIndex] || []).map(h => String(h || ''));
    // Build objects using detected header
    const rows = [];
    for (let i = headerIndex + 1; i < aoa.length; i++) {
      const r = aoa[i] || [];
      if ((r.every(c => String(c).trim() === ''))) continue; // skip empty rows
      const obj = {};
      for (let c = 0; c < headerRow.length; c++) {
        const key = headerRow[c] || `COL_${c}`;
        obj[key] = r[c];
      }
      rows.push(obj);
    }

    const normalizeHeader = (h) => String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();

    // Map possible column names from the sample
    const get = (row, keys) => {
      // exact key
      for (const k of keys) {
        if (k in row && String(row[k]).trim() !== '') return row[k];
      }
      // case-insensitive map
      const map = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeHeader(k), v]));
      for (const k of keys.map(normalizeHeader)) {
        if (k in map && String(map[k]).trim() !== '') return map[k];
      }
      return undefined;
    };

    const results = { created: 0, updated: 0, skipped: 0, errors: [] };
    for (const row of rows) {
      try {
        const itemNumber = String(get(row, ['OEM', 'Item', 'Item Number', 'Part Number', '编号', 'itemNumber']) || '').trim();
        const name = String(get(row, ['Name', 'Product', 'Description', '名称', 'name']) || '').trim() || itemNumber;
        const description = String(get(row, ['Description', 'Desc', '描述', 'description']) || '').trim();
        const quantity = Number(get(row, ['Quantity', 'Qty', '数量', 'stock'])) || 0;

        // Enhanced validation: Check required fields before processing
        if (!itemNumber) {
          results.skipped++;
          results.errors.push({ row, message: 'Missing required field: itemNumber', error: 'Item number is required' });
          continue;
        }

        if (!name || name.trim() === '') {
          results.skipped++;
          results.errors.push({ row, message: 'Missing required field: name', error: 'Product name is required' });
          continue;
        }

        // Always provide a description: Use provided description, or generate from name + itemNumber, or just name
        let finalDescription = description;
        if (!finalDescription || finalDescription.trim() === '') {
          if (name !== itemNumber) {
            finalDescription = `${name} (${itemNumber})`;
          } else {
            finalDescription = name;
          }
        }

        let product = await Product.findOne({ itemNumber });
        if (!product) {
          // Validate all required fields before creating
          const productData = {
            itemNumber,
            name,
            description: finalDescription,
            stock: quantity
          };
          
          // Create product with validation
          product = new Product(productData);
          await product.save();
          results.created++;
        } else {
          // Update existing product
          product.name = name || product.name;
          // Update description if it was empty or if new description is provided
          if (!product.description || product.description.trim() === '' || description) {
            product.description = finalDescription;
          }
          if (Number.isFinite(quantity)) product.stock = quantity;
          if (product.isActive === false) product.isActive = true;
          await product.save();
          results.updated++;
        }
      } catch (e) {
        // Better error handling: Capture validation errors and database errors
        const errorMessage = e.message || String(e);
        const errorDetails = e.errors ? Object.keys(e.errors).map(key => `${key}: ${e.errors[key].message}`).join(', ') : '';
        results.errors.push({ 
          row, 
          message: 'Row processing failed', 
          error: errorMessage,
          details: errorDetails || undefined
        });
      }
    }

    // Clean up uploaded file
    try { fs.unlinkSync(filePath); } catch {}

    try {
      const io = req.app.get('io');
      if (io) io.emit('products:updated', { bulk: true });
    } catch {}

    res.json({ success: true, message: 'Import completed', data: results });
  } catch (error) {
    console.error('Import products from Excel error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Import invoice from Excel/CSV and optionally reduce stock for paid rows
router.post('/invoices/import', [authenticateUser, requireAdmin, excelUpload.single('file')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Lazy require xlsx to keep cold start fast
    if (!xlsx) xlsx = require('xlsx');

    const apply = String(req.query.apply || req.body.apply || 'false').toLowerCase() === 'true';

    const filePath = req.file.path;
    const workbook = xlsx.readFile(filePath, { cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const norm = (v) => String(v || '').replace(/\s+/g, ' ').trim();
    const normLower = (v) => norm(v).toLowerCase();

    // Find header row heuristically: must contain an item number like OEM/Item Number and possibly Quantity
    const headerCandidates = ['oem', 'item number', 'part number', 'item', 'code'];
    let headerIndex = -1;
    for (let i = 0; i < Math.min(aoa.length, 20); i++) {
      const row = aoa[i] || [];
      const tokens = row.map(normLower).filter(Boolean);
      if (tokens.length === 0) continue;
      const hasKey = headerCandidates.some(k => tokens.some(t => t.includes(k)));
      if (hasKey) { headerIndex = i; break; }
    }
    if (headerIndex === -1) {
      headerIndex = aoa.findIndex(r => (r || []).some(c => norm(c) !== ''));
      if (headerIndex === -1) headerIndex = 0;
    }

    const headerRow = (aoa[headerIndex] || []).map(h => String(h || ''));
    const normalizeHeader = (h) => String(h || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const rows = [];
    for (let i = headerIndex + 1; i < aoa.length; i++) {
      const r = aoa[i] || [];
      if ((r.every(c => String(c).trim() === ''))) continue; // skip empty rows
      const obj = {};
      for (let c = 0; c < headerRow.length; c++) {
        const key = headerRow[c] || `COL_${c}`;
        obj[key] = r[c];
      }
      rows.push(obj);
    }

    const get = (row, keys) => {
      for (const k of keys) {
        if (k in row && String(row[k]).trim() !== '') return row[k];
      }
      const map = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeHeader(k), v]));
      for (const k of keys.map(normalizeHeader)) {
        if (k in map && String(map[k]).trim() !== '') return map[k];
      }
      return undefined;
    };

    const preview = [];
    let appliedCount = 0;

    // Pre-compute column indexes by fuzzy header match
    const findColIndex = (predicates) => {
      for (let i = 0; i < headerRow.length; i++) {
        const h = normalizeHeader(headerRow[i]);
        if (predicates.some(p => p(h))) return i;
      }
      return -1;
    };
    const itemIdx = findColIndex([
      h => h.includes('oem'),
      h => h.includes('item') && (h.includes('num') || h.includes('number') || h.includes('nur')), // handle typos like 'Nur'
      h => h.includes('part')
    ]);
    const qtyIdx = findColIndex([
      h => h.includes('qty'),
      h => h.includes('quant')
    ]);
    const paidIdx = findColIndex([
      h => h.includes('paid'),
      h => h.includes('status'),
      h => h.includes('payment')
    ]);

    for (const row of rows) {
      // Prefer key-based extraction; fallback to column index; final fallback: first non-empty cell
      let itemNumber = String(get(row, ['OEM', 'Item', 'Item Number', 'OEM/Item Number', 'Part Number', 'itemNumber']) || '').trim();
      if (!itemNumber && itemIdx >= 0) itemNumber = String(row[headerRow[itemIdx]] || row[itemIdx] || '').trim();
      if (!itemNumber) {
        const firstVal = Object.values(row).find(v => String(v || '').trim() !== '');
        if (firstVal) itemNumber = String(firstVal).trim();
      }

      let quantityRaw = get(row, ['Quantity', 'Qty', 'QTY', '数量']);
      if (quantityRaw === undefined && qtyIdx >= 0) quantityRaw = row[headerRow[qtyIdx]] ?? row[qtyIdx];
      const qty = Number(String(quantityRaw || '').replace(/[^0-9.\-]/g, '')) || 0;

      let statusRaw = String(get(row, ['Paid', 'Status', 'Payment Status']) || '').trim();
      if (!statusRaw && paidIdx >= 0) statusRaw = String(row[headerRow[paidIdx]] ?? row[paidIdx] ?? '').trim();
      const isPaid = /^(paid|yes|true|تم|مدفوع)$/i.test(statusRaw);

      if (!itemNumber || qty <= 0) {
        preview.push({ itemNumber, quantity: qty, paid: isPaid, matched: false, reason: 'Missing item number or qty' });
        continue;
      }

      const product = await Product.findOne({ itemNumber });
      if (!product || product.isActive === false) {
        preview.push({ itemNumber, quantity: qty, paid: isPaid, matched: false, reason: 'Product not found' });
        continue;
      }

      let newStock = product.stock;
      if (apply && isPaid) {
        await Product.findByIdAndUpdate(product._id, { $inc: { stock: -qty } });
        newStock = (product.stock || 0) - qty;
        appliedCount++;
      } else if (isPaid) {
        newStock = (product.stock || 0) - qty;
      }

      preview.push({
        itemNumber,
        productId: String(product._id),
        name: product.name,
        quantity: qty,
        paid: isPaid,
        matched: true,
        currentStock: product.stock || 0,
        newStock
      });
    }

    // Clean up uploaded file
    try { fs.unlinkSync(filePath); } catch {}

    // Emit a products update if applied
    if (apply) {
      try {
        const io = req.app.get('io');
        if (io) io.emit('products:updated', { bulk: true });
      } catch {}
    }

    res.json({ success: true, message: apply ? 'Invoice applied' : 'Invoice parsed', data: { preview, appliedCount } });
  } catch (error) {
    console.error('Import invoice error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
