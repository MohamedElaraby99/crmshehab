const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Product');
const ProductPurchase = require('../models/ProductPurchase');
const { authenticateUser, authenticateVendor, authenticateUserOrVendor } = require('../middleware/auth');

const router = express.Router();
// Transfer a quantity from an order item into a new order
router.post('/:id/items/:itemIndex/transfer', [
  authenticateVendor,
  body('transferQuantity').isInt({ min: 1 }).withMessage('transferQuantity must be >= 1'),
  body('newOrder').optional().isObject().withMessage('newOrder must be an object')
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

    // Vendor authorization: allow vendor to transfer only within their orders
    if (order.vendorId && String(order.vendorId) !== String(req.vendor._id)) {
      return res.status(403).json({ success: false, message: 'Access denied for this order' });
    }

    const itemIndex = parseInt(req.params.itemIndex, 10);
    if (Number.isNaN(itemIndex) || itemIndex < 0 || itemIndex >= (order.items?.length || 0)) {
      return res.status(400).json({ success: false, message: 'Invalid item index' });
    }

    const srcItem = order.items[itemIndex];
    if (!srcItem) return res.status(404).json({ success: false, message: 'Item not found' });

    const transferQty = typeof req.body.transferQuantity === 'string' ? parseInt(req.body.transferQuantity, 10) : req.body.transferQuantity;
    if (transferQty > (srcItem.quantity || 0)) {
      return res.status(400).json({ success: false, message: 'Transfer quantity exceeds item quantity' });
    }

    // Reduce source item quantity (or remove if zero)
    order.items[itemIndex].quantity = (srcItem.quantity || 0) - transferQty;
    if (order.items[itemIndex].quantity === 0) {
      order.items.splice(itemIndex, 1);
    }

    // Prepare new order payload
    const nowSuffix = String(Date.now()).slice(-6);
    const newOrderNumber = `ORD-${nowSuffix}`;
    const newItem = {
      productId: srcItem.productId,
      itemNumber: srcItem.itemNumber,
      quantity: transferQty,
      unitPrice: srcItem.unitPrice,
      totalPrice: typeof srcItem.unitPrice === 'number' ? srcItem.unitPrice * transferQty : undefined,
      status: 'pending',
      notes: srcItem.notes,
      estimatedDateReady: srcItem.estimatedDateReady,
      confirmFormShehab: srcItem.confirmFormShehab,
      invoiceNumber: undefined,
      transferAmount: undefined
    };

    const newOrderPayload = req.body.newOrder || {};
    const newOrder = await Order.create({
      orderNumber: newOrderNumber,
      vendorId: order.vendorId,
      items: [newItem],
      status: 'pending',
      notes: newOrderPayload.notes || '',
      shippingAddress: newOrderPayload.shippingAddress || {},
      expectedDeliveryDate: newOrderPayload.expectedDeliveryDate || undefined,
      confirmFormShehab: newOrderPayload.confirmFormShehab || undefined,
      price: newOrderPayload.price || undefined
    });

    // Save updated source order
    await order.save();

    // Fetch populated versions
    const updatedOrder = await Order.findById(order._id).populate([
      { path: 'vendorId', select: 'name' },
      { path: 'items.productId', select: 'name itemNumber images' }
    ]);
    const createdOrder = await Order.findById(newOrder._id).populate([
      { path: 'vendorId', select: 'name' },
      { path: 'items.productId', select: 'name itemNumber images' }
    ]);

    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('orders:updated', { id: String(order._id) });
        io.emit('orders:created', { id: String(newOrder._id) });
        io.emit('notifications:push', {
          type: 'item_transferred',
          orderId: order._id,
          message: `Transferred ${transferQty} of ${srcItem.itemNumber} to ${newOrderNumber}`,
          at: new Date().toISOString()
        });
      }
    } catch {}

    return res.status(201).json({ success: true, data: { updatedOrder, newOrder: createdOrder } });
  } catch (error) {
    console.error('Transfer item quantity error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

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
        { path: 'items.productId', select: 'name itemNumber images' }
      ]);

    // Filter by item count if needed
    if (query._itemCountFilter) {
      orders = orders.filter(order => order.items.length === query._itemCountFilter);
    }

    // Note: Item-level field migration removed to prevent VersionError conflicts
    // Fields will be added automatically when orders are created or updated

    // Auto-update order statuses based on item statuses
    for (const order of orders) {
      if (order.items && order.items.length > 0) {
        const allItemsConfirmed = order.items.every(item => item.status === 'confirmed');
        const allItemsShipped = order.items.every(item => item.status === 'shipped');
        const allItemsDelivered = order.items.every(item => item.status === 'delivered');
        const anyItemCancelled = order.items.some(item => item.status === 'cancelled');
        
        let newOrderStatus = order.status;
        
        if (allItemsDelivered) {
          newOrderStatus = 'delivered';
        } else if (allItemsShipped) {
          newOrderStatus = 'shipped';
        } else if (allItemsConfirmed) {
          newOrderStatus = 'confirmed';
        } else if (anyItemCancelled) {
          newOrderStatus = 'cancelled';
        }
        
        if (newOrderStatus !== order.status) {
          console.log(`Auto-updating order ${order.orderNumber} status from ${order.status} to ${newOrderStatus}`);
          order.status = newOrderStatus;
          await order.save();
        }
      }
    }

    // Transform orders to include itemImageUrl for frontend compatibility
    const transformedOrders = orders.map(order => {
      const orderObj = order.toJSON();
      
      // Debug logging
      console.log('Transforming order:', {
        orderId: orderObj.id,
        hasImagePath: !!orderObj.imagePath,
        hasItemImageUrl: !!orderObj.itemImageUrl,
        imagePath: orderObj.imagePath,
        itemImageUrl: orderObj.itemImageUrl
      });
      
      // ALWAYS ensure both fields exist for consistency
      if (orderObj.imagePath && !orderObj.itemImageUrl) {
        orderObj.itemImageUrl = orderObj.imagePath;
        console.log('Copied imagePath to itemImageUrl:', orderObj.itemImageUrl);
      }
      if (orderObj.itemImageUrl && !orderObj.imagePath) {
        orderObj.imagePath = orderObj.itemImageUrl;
        console.log('Copied itemImageUrl to imagePath:', orderObj.imagePath);
      }
      
      // If both exist but are different, prefer imagePath as the source of truth
      if (orderObj.imagePath && orderObj.itemImageUrl && orderObj.imagePath !== orderObj.itemImageUrl) {
        console.log('Both fields exist but different, updating itemImageUrl to match imagePath');
        orderObj.itemImageUrl = orderObj.imagePath;
      }
      
      // Also ensure item-level images have both fields for consistency
      if (orderObj.items && Array.isArray(orderObj.items)) {
        orderObj.items = orderObj.items.map(item => {
          if (item.imagePath && !item.itemImageUrl) {
            item.itemImageUrl = item.imagePath;
          }
          if (item.itemImageUrl && !item.imagePath) {
            item.imagePath = item.itemImageUrl;
          }
          return item;
        });
      }
      
      console.log('Final transformed order:', {
        orderId: orderObj.id,
        imagePath: orderObj.imagePath,
        itemImageUrl: orderObj.itemImageUrl
      });
      
      return orderObj;
    });

    const total = await Order.countDocuments({ ...query, _itemCountFilter: undefined });

    res.json({
      success: true,
      data: transformedOrders,
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
  body('items.*.productId').custom((value) => {
    // Allow either valid MongoDB ObjectId or non-empty string (for itemNumber)
    if (!value || value === '') {
      throw new Error('Product ID is required');
    }
    // Check if it's a valid ObjectId format or a non-empty string
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(value);
    if (!isValidObjectId && typeof value !== 'string') {
      throw new Error('Product ID must be a valid ObjectId or item number string');
    }
    return true;
  }),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice').optional().isNumeric().withMessage('Unit price must be a number'),
  body('items.*.totalPrice').optional().isNumeric().withMessage('Total price must be a number'),
  body('items.*.priceApprovalStatus').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid price approval status'),
  body('items.*.priceApprovalRejectionReason').optional().trim().isLength({ max: 500 }).withMessage('Item rejection reason too long'),
  body('items.*.status').optional().isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid item status'),
  body('items.*.notes').optional().trim().isLength({ max: 500 }).withMessage('Item notes too long'),
  body('items.*.estimatedDateReady').optional().trim().isLength({ max: 100 }).withMessage('Item estimated date too long'),
  body('items.*.confirmFormShehab').optional().trim().isLength({ max: 100 }).withMessage('Item confirm form too long'),
  body('items.*.invoiceNumber').optional().trim().isLength({ max: 100 }).withMessage('Item invoice number too long'),
  body('items.*.transferAmount').optional().isNumeric().withMessage('Item transfer amount must be a number'),
  body('items.*.shippingDateToAgent').optional().trim().isLength({ max: 100 }).withMessage('Item shipping date too long'),
  body('items.*.shippingDateToSaudi').optional().trim().isLength({ max: 100 }).withMessage('Item shipping date too long'),
  body('items.*.arrivalDate').optional().trim().isLength({ max: 100 }).withMessage('Item arrival date too long'),
  body('price').optional().isNumeric().withMessage('Price must be a number')
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

    const { vendorId, items, shippingAddress, notes, expectedDeliveryDate, orderNumber: providedOrderNumber, confirmFormShehab, price } = req.body;

    // Use provided order number or generate one
    const orderNumber = providedOrderNumber || `ORD-${String(Date.now()).slice(-6)}`;

    // Do not calculate or require prices on creation
    let totalAmount = undefined;
    const processedItems = [];

    for (const item of items) {
      let product;

      // Check if productId is a valid MongoDB ObjectId or if it's an itemNumber (string)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(item.productId);

      if (isValidObjectId) {
        // Try to find by ObjectId first
        product = await Product.findById(item.productId);
      }

      if (!product) {
        // If not found by ObjectId, try to find by itemNumber
        product = await Product.findOne({ itemNumber: item.productId, isActive: true });
      }

      if (!product) {
        // If product still not found, create a new product with the itemNumber
        console.log(`Creating new product for itemNumber: ${item.productId}`);
        product = await Product.create({
          name: item.productName || item.itemNumber,
          itemNumber: item.productId,
          description: `Auto-created product for item ${item.productId}`,
          isActive: true
        });
      }

      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.productId} not found or inactive`
        });
      }

      processedItems.push({
        productId: product._id,
        itemNumber: product.itemNumber,
        quantity: item.quantity,
        unitPrice: item.unitPrice || undefined,
        totalPrice: item.totalPrice || undefined,
        priceApprovalStatus: item.priceApprovalStatus || 'pending',
        priceApprovalRejectionReason: item.priceApprovalRejectionReason || '',
        status: item.status || 'pending',
        notes: item.notes || '',
        estimatedDateReady: item.estimatedDateReady || '',
        confirmFormShehab: item.confirmFormShehab || '',
        invoiceNumber: item.invoiceNumber || '',
        transferAmount: item.transferAmount || undefined,
        shippingDateToAgent: item.shippingDateToAgent || '',
        shippingDateToSaudi: item.shippingDateToSaudi || '',
        arrivalDate: item.arrivalDate || '',
        isActive: item.isActive !== undefined ? item.isActive : true,
        stockAdjusted: item.stockAdjusted !== undefined ? item.stockAdjusted : false,
        orderDate: item.orderDate || new Date(),
        createdAt: item.createdAt || new Date(),
        updatedAt: item.updatedAt || new Date(),
        price: item.price || undefined,
        totalAmount: item.totalAmount || 0,
        imagePath: item.imagePath || '',
        itemImageUrl: item.itemImageUrl || ''
      });
    }

    const order = new Order({
      orderNumber,
      vendorId,
      items: processedItems,
      totalAmount,
      price,
      shippingAddress,
      notes,
      expectedDeliveryDate,
      confirmFormShehab
    });

    await order.save();
    await order.populate([
      { path: 'vendorId', select: 'name contactPerson email' },
      { path: 'items.productId', select: 'name itemNumber images' }
    ]);

    // Transform order to include itemImageUrl for frontend compatibility
    const orderObj = order.toJSON();
    
    // ALWAYS ensure both fields exist for consistency
    if (orderObj.imagePath && !orderObj.itemImageUrl) {
      orderObj.itemImageUrl = orderObj.imagePath;
    }
    if (orderObj.itemImageUrl && !orderObj.imagePath) {
      orderObj.imagePath = orderObj.itemImageUrl;
    }
    
    // If both exist but are different, prefer imagePath as the source of truth
    if (orderObj.imagePath && orderObj.itemImageUrl && orderObj.imagePath !== orderObj.itemImageUrl) {
      orderObj.itemImageUrl = orderObj.imagePath;
    }
    
    // Also ensure item-level images have both fields for consistency
    if (orderObj.items && Array.isArray(orderObj.items)) {
      orderObj.items = orderObj.items.map(item => {
        if (item.imagePath && !item.itemImageUrl) {
          item.itemImageUrl = item.imagePath;
        }
        if (item.itemImageUrl && !item.imagePath) {
          item.imagePath = item.itemImageUrl;
        }
        return item;
      });
    }

    // Emit socket event for new order
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('orders:created', orderObj);
        // Notification for admins
        io.emit('notifications:push', {
          type: 'order_created',
          orderId: orderObj.id || orderObj._id,
          orderNumber: orderObj.orderNumber,
          vendorName: typeof orderObj.vendorId === 'object' ? orderObj.vendorId?.name : undefined,
          message: `New order ${orderObj.orderNumber} created`,
          at: new Date().toISOString()
        });
      }
    } catch {}

    res.status(201).json({ success: true, data: orderObj });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Update order
router.put('/:id', [
  authenticateUserOrVendor,
  body('status').optional().isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid status'),
  body('items').optional().isArray().withMessage('Items must be an array'),
  body('items.*.priceApprovalStatus').optional().isIn(['pending', 'approved', 'rejected']).withMessage('Invalid item price approval status'),
  body('items.*.priceApprovalRejectionReason').optional().trim().isLength({ max: 500 }).withMessage('Item rejection reason too long'),
  body('items.*.status').optional().isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid item status'),
  body('items.*.notes').optional().trim().isLength({ max: 500 }).withMessage('Item notes too long'),
  body('items.*.estimatedDateReady').optional().trim().isLength({ max: 100 }).withMessage('Item estimated date too long'),
  body('items.*.confirmFormShehab').optional().trim().isLength({ max: 100 }).withMessage('Item confirm form too long'),
  body('items.*.invoiceNumber').optional().trim().isLength({ max: 100 }).withMessage('Item invoice number too long'),
  body('items.*.transferAmount').optional().isNumeric().withMessage('Item transfer amount must be a number'),
  body('items.*.shippingDateToAgent').optional().trim().isLength({ max: 100 }).withMessage('Item shipping date too long'),
  body('items.*.shippingDateToSaudi').optional().trim().isLength({ max: 100 }).withMessage('Item shipping date too long'),
  body('items.*.arrivalDate').optional().trim().isLength({ max: 100 }).withMessage('Item arrival date too long'),
  body('confirmFormShehab').optional().trim().isLength({ max: 500 }).withMessage('Confirmation form too long'),
  body('estimatedDateReady').optional().trim().isLength({ max: 100 }).withMessage('Estimated date too long'),
  body('invoiceNumber').optional().trim().isLength({ max: 100 }).withMessage('Invoice number too long'),
  body('transferAmount').optional().isNumeric().withMessage('Transfer amount must be a number'),
  body('price').optional().isNumeric().withMessage('Price must be a number'),
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


    // Handle individual item updates (for item-level fields)
    if (req.body.itemIndex !== undefined && req.body.itemIndex >= 0) {
      const itemIndex = req.body.itemIndex;
      
      console.log('Backend: Received item update request:', {
        orderId: req.params.id,
        itemIndex: itemIndex,
        orderItemsCount: order.items.length,
        requestBody: req.body
      });
      
      // Validate that the item index is within bounds
      if (itemIndex >= order.items.length) {
        console.log('Backend: Item index out of bounds:', itemIndex, '>=', order.items.length);
        return res.status(400).json({ 
          success: false, 
          message: `Item index ${itemIndex} is out of bounds. Order has ${order.items.length} items.` 
        });
      }
      
      const itemUpdates = {};
      
      // Handle item-specific fields
      if (req.body.itemPriceApprovalStatus !== undefined) {
        itemUpdates[`items.${itemIndex}.priceApprovalStatus`] = req.body.itemPriceApprovalStatus;
      }
      // Also accept priceApprovalStatus for convenience when itemIndex is provided
      if (req.body.priceApprovalStatus !== undefined) {
        itemUpdates[`items.${itemIndex}.priceApprovalStatus`] = req.body.priceApprovalStatus;
      }
      if (req.body.itemPriceApprovalRejectionReason !== undefined) {
        itemUpdates[`items.${itemIndex}.priceApprovalRejectionReason`] = req.body.itemPriceApprovalRejectionReason;
      }
      // Also accept priceApprovalRejectionReason for convenience when itemIndex is provided
      if (req.body.priceApprovalRejectionReason !== undefined) {
        itemUpdates[`items.${itemIndex}.priceApprovalRejectionReason`] = req.body.priceApprovalRejectionReason;
      }
      if (req.body.itemStatus !== undefined) {
        itemUpdates[`items.${itemIndex}.status`] = req.body.itemStatus;
      }
      // Also accept 'status' as item status when itemIndex is provided
      if (req.body.status !== undefined) {
        itemUpdates[`items.${itemIndex}.status`] = req.body.status;
      }
      if (req.body.itemNotes !== undefined) {
        itemUpdates[`items.${itemIndex}.notes`] = req.body.itemNotes;
      }
      if (req.body.itemEstimatedDateReady !== undefined) {
        itemUpdates[`items.${itemIndex}.estimatedDateReady`] = req.body.itemEstimatedDateReady;
      }
      
      // Accept common item-level fields when itemIndex is provided
      if (req.body.unitPrice !== undefined) {
        itemUpdates[`items.${itemIndex}.unitPrice`] = typeof req.body.unitPrice === 'string' ? parseFloat(req.body.unitPrice) : req.body.unitPrice;
      }
      if (req.body.quantity !== undefined) {
        itemUpdates[`items.${itemIndex}.quantity`] = typeof req.body.quantity === 'string' ? parseInt(req.body.quantity, 10) : req.body.quantity;
      }
      if (req.body.notes !== undefined) {
        itemUpdates[`items.${itemIndex}.notes`] = req.body.notes;
      }
      if (req.body.estimatedDateReady !== undefined) {
        itemUpdates[`items.${itemIndex}.estimatedDateReady`] = req.body.estimatedDateReady;
      }
      if (req.body.confirmFormShehab !== undefined) {
        itemUpdates[`items.${itemIndex}.confirmFormShehab`] = req.body.confirmFormShehab;
      }
      if (req.body.invoiceNumber !== undefined) {
        itemUpdates[`items.${itemIndex}.invoiceNumber`] = req.body.invoiceNumber;
      }
      if (req.body.transferAmount !== undefined) {
        itemUpdates[`items.${itemIndex}.transferAmount`] = typeof req.body.transferAmount === 'string' ? parseFloat(req.body.transferAmount) : req.body.transferAmount;
      }
      if (req.body.shippingDateToAgent !== undefined) {
        itemUpdates[`items.${itemIndex}.shippingDateToAgent`] = req.body.shippingDateToAgent;
      }
      if (req.body.shippingDateToSaudi !== undefined) {
        itemUpdates[`items.${itemIndex}.shippingDateToSaudi`] = req.body.shippingDateToSaudi;
      }
      if (req.body.arrivalDate !== undefined) {
        itemUpdates[`items.${itemIndex}.arrivalDate`] = req.body.arrivalDate;
      }

      // Apply item-specific updates
      if (Object.keys(itemUpdates).length > 0) {
        console.log('Backend: Applying item-specific updates:', JSON.stringify(itemUpdates, null, 2));
        Object.assign(updateData, itemUpdates);
        console.log('Backend: Final updateData after item updates:', JSON.stringify(updateData, null, 2));
        
      }
    }

    // Handle full items array updates (for bulk operations) - only if no individual item updates
    if (req.body.items && Array.isArray(req.body.items) && req.body.itemIndex === undefined) {
      console.log('Backend: Received full items array update (no itemIndex)');
      console.log('Backend: Items count in request:', req.body.items.length);
      
      // Process items to ensure productId is just the ID string, not the populated object
      const processedItems = req.body.items.map(item => {
        const processedItem = { ...item };
        
        // If productId is an object (populated), extract just the ID
        if (typeof item.productId === 'object' && item.productId !== null) {
          processedItem.productId = item.productId._id || item.productId.id;
        }
        
        return processedItem;
      });
      
      console.log('Backend: Processed items for update:', JSON.stringify(processedItems, null, 2));
      updateData.items = processedItems;
    } else if (req.body.items && Array.isArray(req.body.items) && req.body.itemIndex !== undefined) {
      console.log('Backend: WARNING - Received both items array AND itemIndex. Ignoring items array to prevent data loss.');
      console.log('Backend: This might indicate a frontend issue where both individual and bulk updates are being sent.');
    }

    // Handle fields for both order-level and item-level updates
    if (req.body.confirmFormShehab !== undefined) updateData.confirmFormShehab = req.body.confirmFormShehab;
    if (req.body.estimatedDateReady !== undefined) updateData.estimatedDateReady = req.body.estimatedDateReady;
    if (req.body.invoiceNumber !== undefined) updateData.invoiceNumber = req.body.invoiceNumber;
    if (req.body.transferAmount !== undefined) updateData.transferAmount = req.body.transferAmount;
    if (req.body.price !== undefined) updateData.price = req.body.price;
    if (req.body.shippingDateToAgent !== undefined) updateData.shippingDateToAgent = req.body.shippingDateToAgent;
    if (req.body.shippingDateToSaudi !== undefined) updateData.shippingDateToSaudi = req.body.shippingDateToSaudi;
    if (req.body.arrivalDate !== undefined) updateData.arrivalDate = req.body.arrivalDate;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;

    // Apply updates
    console.log('Backend: Applying update data:', JSON.stringify(updateData, null, 2));
    
    // For individual item updates, use a different approach to preserve all items
    if (req.body.itemIndex !== undefined && req.body.itemIndex >= 0) {
      console.log('Backend: Using individual item update approach');
      console.log('Backend: Item index:', req.body.itemIndex);
      console.log('Backend: Update data:', JSON.stringify(updateData, null, 2));
      console.log('Backend: Request body:', JSON.stringify(req.body, null, 2));
      
      // Update the specific item in the order
      const itemIndex = parseInt(req.body.itemIndex);
      if (order.items && order.items[itemIndex]) {
        // Directly apply simple fields in case path-based merge is skipped later
        if (req.body.priceApprovalStatus !== undefined) {
          order.items[itemIndex].priceApprovalStatus = req.body.priceApprovalStatus;
          // If approved, auto-set confirmFormShehab to today's date (admin-triggered)
          try {
            const isAdmin = !!(req.user && req.user.role === 'admin');
            if (isAdmin && String(req.body.priceApprovalStatus).toLowerCase() === 'approved') {
              const today = new Date().toISOString().split('T')[0];
              order.items[itemIndex].confirmFormShehab = today;
            }
          } catch {}
        }
        if (req.body.itemPriceApprovalStatus !== undefined) {
          order.items[itemIndex].priceApprovalStatus = req.body.itemPriceApprovalStatus;
          // If approved, auto-set confirmFormShehab to today's date (admin-triggered)
          try {
            const isAdmin = !!(req.user && req.user.role === 'admin');
            if (isAdmin && String(req.body.itemPriceApprovalStatus).toLowerCase() === 'approved') {
              const today = new Date().toISOString().split('T')[0];
              order.items[itemIndex].confirmFormShehab = today;
            }
          } catch {}
        }
        if (req.body.priceApprovalRejectionReason !== undefined) {
          order.items[itemIndex].priceApprovalRejectionReason = req.body.priceApprovalRejectionReason;
        }
        if (req.body.itemPriceApprovalRejectionReason !== undefined) {
          order.items[itemIndex].priceApprovalRejectionReason = req.body.itemPriceApprovalRejectionReason;
        }
        if (req.body.itemStatus !== undefined) {
          order.items[itemIndex].status = req.body.itemStatus;
        }
        if (req.body.status !== undefined) {
          order.items[itemIndex].status = req.body.status;
        }
        // Update the specific item with the provided fields
        console.log(`Backend: Updating item at index ${itemIndex}`);
        console.log(`Backend: Item before update:`, JSON.stringify(order.items[itemIndex], null, 2));
        
        for (const [key, value] of Object.entries(updateData)) {
          console.log(`Backend: Processing field ${key} with value:`, value);
          if (key.startsWith('items.')) {
            const path = key.split('.');
            if (path.length === 3 && path[0] === 'items' && path[1] === itemIndex.toString()) {
              const field = path[2];
              order.items[itemIndex][field] = value;
              console.log(`Backend: Updated order.items[${itemIndex}].${field} to:`, value);
            }
          } else {
            // Direct field update for the specific item
            order.items[itemIndex][key] = value;
            console.log(`Backend: Updated order.items[${itemIndex}].${key} to:`, value);
            console.log(`Backend: Item after update:`, JSON.stringify(order.items[itemIndex], null, 2));
          }
        }
        
        console.log(`Backend: Item after all updates:`, JSON.stringify(order.items[itemIndex], null, 2));
        
        // Mark the items array as modified so Mongoose saves the changes
        order.markModified('items');
        console.log('Backend: Marked items array as modified');
        
        // Recalculate totalPrice for the item if quantity or unitPrice changed
        const qtyVal = Number(order.items[itemIndex].quantity) || 0;
        const unitPriceVal = Number(order.items[itemIndex].unitPrice) || 0;
        order.items[itemIndex].totalPrice = qtyVal * unitPriceVal;
        console.log(`Backend: Recalculated totalPrice for item ${itemIndex}:`, order.items[itemIndex].totalPrice);
        
        // Recalculate order total amount
        order.totalAmount = order.items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
        console.log('Backend: Recalculated order totalAmount:', order.totalAmount);
      } else {
        console.log('Backend: ERROR - Item index out of range or items array not found');
        return res.status(400).json({ success: false, message: 'Item index out of range' });
      }
      
      // Save the order with all items preserved
      console.log('Backend: Order before save - item confirmFormShehab:', order.items[itemIndex].confirmFormShehab);
      console.log('Backend: Order before save - item estimatedDateReady:', order.items[itemIndex].estimatedDateReady);
      console.log('Backend: Order before save - all item fields:', JSON.stringify(order.items[itemIndex], null, 2));
      await order.save();
      console.log('Backend: Order saved with all items preserved');
      console.log('Backend: Order after save - item confirmFormShehab:', order.items[itemIndex].confirmFormShehab);
      console.log('Backend: Order after save - item estimatedDateReady:', order.items[itemIndex].estimatedDateReady);
      
      // Fetch the complete updated order
      const updatedOrder = await Order.findById(req.params.id);
      console.log('Backend: Updated order after save:', JSON.stringify(updatedOrder?.items, null, 2));
      console.log('Backend: Updated order items count:', updatedOrder?.items?.length);
      console.log('Backend: Item 0 confirmFormShehab:', updatedOrder?.items?.[0]?.confirmFormShehab);
      
      // Auto-update order status based on item statuses
      if (updatedOrder && updatedOrder.items && updatedOrder.items.length > 0) {
        const allItemsConfirmed = updatedOrder.items.every(item => item.status === 'confirmed');
        const allItemsShipped = updatedOrder.items.every(item => item.status === 'shipped');
        const allItemsDelivered = updatedOrder.items.every(item => item.status === 'delivered');
        const anyItemCancelled = updatedOrder.items.some(item => item.status === 'cancelled');
        
        let newOrderStatus = updatedOrder.status;
        
        if (allItemsDelivered) {
          newOrderStatus = 'delivered';
        } else if (allItemsShipped) {
          newOrderStatus = 'shipped';
        } else if (allItemsConfirmed) {
          newOrderStatus = 'confirmed';
        } else if (anyItemCancelled) {
          newOrderStatus = 'cancelled';
        }
        
        if (newOrderStatus !== updatedOrder.status) {
          console.log(`Backend: Auto-updating order status from ${updatedOrder.status} to ${newOrderStatus}`);
          updatedOrder.status = newOrderStatus;
          await updatedOrder.save();
        }
      }
    } else {
      // For non-item updates, use the regular approach
      const updatedOrder = await Order.findByIdAndUpdate(req.params.id, updateData, { runValidators: true, new: true });
      console.log('Backend: Updated order after findByIdAndUpdate:', JSON.stringify(updatedOrder?.items, null, 2));
    }

    // Adjust stock and create/remove purchase records if needed
    const newStatus = updateData.status || previousStatus;
    const isNowConfirmed = newStatus === 'confirmed';
    const leftConfirmed = previousStatus === 'confirmed' && newStatus !== 'confirmed';

    if (isNowConfirmed && !order.stockAdjusted) {
      // Decrease stock for each item (client order accepted)
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -(item.quantity || 0) } });
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
      // Rollback stock for each item (restore)
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, { $inc: { stock: (item.quantity || 0) } });
      }
      // Remove purchase records for this order
      await ProductPurchase.deleteMany({ orderId: order._id });
      order.stockAdjusted = false;
      await order.save();
    }

    // Fetch the final updated order with populated fields
    const finalUpdatedOrder = await Order.findById(req.params.id).populate([
      { path: 'vendorId', select: 'name contactPerson email' },
      { path: 'items.productId', select: 'name itemNumber images' }
    ]);

    console.log('OrderRow: Final updated order from DB:', JSON.stringify(finalUpdatedOrder.items, null, 2));

    // Transform order to include itemImageUrl for frontend compatibility
    const orderObj = finalUpdatedOrder.toObject();
    
    // ALWAYS ensure both fields exist for consistency
    if (orderObj.imagePath && !orderObj.itemImageUrl) {
      orderObj.itemImageUrl = orderObj.imagePath;
    }
    if (orderObj.itemImageUrl && !orderObj.imagePath) {
      orderObj.imagePath = orderObj.itemImageUrl;
    }
    
    // If both exist but are different, prefer imagePath as the source of truth
    if (orderObj.imagePath && orderObj.itemImageUrl && orderObj.imagePath !== orderObj.itemImageUrl) {
      orderObj.itemImageUrl = orderObj.imagePath;
    }
    
    // Also ensure item-level images have both fields for consistency
    if (orderObj.items && Array.isArray(orderObj.items)) {
      orderObj.items = orderObj.items.map(item => {
        if (item.imagePath && !item.itemImageUrl) {
          item.itemImageUrl = item.imagePath;
        }
        if (item.itemImageUrl && !item.imagePath) {
          item.imagePath = item.itemImageUrl;
        }
        return item;
      });
    }

    // Emit socket event for order update
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('orders:updated', orderObj);
        io.emit('notifications:push', {
          type: 'order_updated',
          orderId: orderObj.id || orderObj._id,
          orderNumber: orderObj.orderNumber,
          vendorName: typeof orderObj.vendorId === 'object' ? orderObj.vendorId?.name : undefined,
          message: `Order ${orderObj.orderNumber} updated`,
          at: new Date().toISOString()
        });
      }
    } catch {}

    res.json({ success: true, message: 'Order updated successfully', data: orderObj });
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

    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('orders:deleted', { id: req.params.id });
        io.emit('notifications:push', {
          type: 'order_deleted',
          orderId: req.params.id,
          message: `Order deleted`,
          at: new Date().toISOString()
        });
      }
    } catch {}
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
        { path: 'items.productId', select: 'name itemNumber images' }
      ]);

    // Note: Item-level field migration removed to prevent VersionError conflicts
    // Fields will be added automatically when orders are created or updated

    // Transform orders to include itemImageUrl for frontend compatibility
    const transformedOrders = orders.map(order => {
      const orderObj = order.toJSON();
      
      // ALWAYS ensure both fields exist for consistency
      if (orderObj.imagePath && !orderObj.itemImageUrl) {
        orderObj.itemImageUrl = orderObj.imagePath;
      }
      if (orderObj.itemImageUrl && !orderObj.imagePath) {
        orderObj.imagePath = orderObj.itemImageUrl;
      }
      
      // If both exist but are different, prefer imagePath as the source of truth
      if (orderObj.imagePath && orderObj.itemImageUrl && orderObj.imagePath !== orderObj.itemImageUrl) {
        orderObj.itemImageUrl = orderObj.imagePath;
      }
      
      // Also ensure item-level images have both fields for consistency
      if (orderObj.items && Array.isArray(orderObj.items)) {
        orderObj.items = orderObj.items.map(item => {
          if (item.imagePath && !item.itemImageUrl) {
            item.itemImageUrl = item.imagePath;
          }
          if (item.itemImageUrl && !item.imagePath) {
            item.imagePath = item.itemImageUrl;
          }
          return item;
        });
      }
      
      return orderObj;
    });

    res.json({ success: true, data: transformedOrders });
  } catch (error) {
    console.error('Get vendor orders error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Confirm item and add to stock
router.post('/:id/confirm-item', authenticateUserOrVendor, async (req, res) => {
  try {
    const { itemIndex, quantity } = req.body;
    
    if (itemIndex === undefined || itemIndex < 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid item index is required' 
      });
    }
    
    const order = await Order.findById(req.params.id);
    if (!order || !order.isActive) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Validate item index
    if (itemIndex >= order.items.length) {
      return res.status(400).json({ 
        success: false, 
        message: `Item index ${itemIndex} is out of bounds. Order has ${order.items.length} items.` 
      });
    }
    
    const item = order.items[itemIndex];
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }
    
    // Check if item is already confirmed
    if (item.status === 'confirmed') {
      return res.status(400).json({ 
        success: false, 
        message: 'Item is already confirmed' 
      });
    }
    
    // Get the product to update stock
    const product = await Product.findById(item.productId);
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: 'Product not found' 
      });
    }
    
    // Update item status to confirmed
    order.items[itemIndex].status = 'confirmed';
    order.items[itemIndex].stockAdjusted = true;
    
    // Add quantity to product stock
    const newStock = (product.stock || 0) + (item.quantity || 0);
    await Product.findByIdAndUpdate(item.productId, { stock: newStock });
    
    // Create purchase record
    const populatedVendor = await Order.findById(order._id).populate({ path: 'vendorId', select: 'name' });
    const vendorName = populatedVendor?.vendorId?.name || 'Unknown';
    const now = new Date();
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
      notes: `Item confirmation - ${order.notes || ''}`
    });
    
    // Mark the items array as modified
    order.markModified('items');
    
    // Auto-update order status based on item statuses
    if (order.items && order.items.length > 0) {
      const allItemsConfirmed = order.items.every(item => item.status === 'confirmed');
      const allItemsShipped = order.items.every(item => item.status === 'shipped');
      const allItemsDelivered = order.items.every(item => item.status === 'delivered');
      const anyItemCancelled = order.items.some(item => item.status === 'cancelled');
      
      let newOrderStatus = order.status;
      
      if (allItemsDelivered) {
        newOrderStatus = 'delivered';
      } else if (allItemsShipped) {
        newOrderStatus = 'shipped';
      } else if (allItemsConfirmed) {
        newOrderStatus = 'confirmed';
      } else if (anyItemCancelled) {
        newOrderStatus = 'cancelled';
      }
      
      if (newOrderStatus !== order.status) {
        order.status = newOrderStatus;
      }
    }
    
    // Save the order
    await order.save();
    
    // Fetch the updated order with populated fields
    const updatedOrder = await Order.findById(req.params.id).populate([
      { path: 'vendorId', select: 'name contactPerson email' },
      { path: 'items.productId', select: 'name itemNumber images' }
    ]);
    
    // Transform order to include itemImageUrl for frontend compatibility
    const orderObj = updatedOrder.toObject();
    
    // ALWAYS ensure both fields exist for consistency
    if (orderObj.imagePath && !orderObj.itemImageUrl) {
      orderObj.itemImageUrl = orderObj.imagePath;
    }
    if (orderObj.itemImageUrl && !orderObj.imagePath) {
      orderObj.imagePath = orderObj.itemImageUrl;
    }
    
    // If both exist but are different, prefer imagePath as the source of truth
    if (orderObj.imagePath && orderObj.itemImageUrl && orderObj.imagePath !== orderObj.itemImageUrl) {
      orderObj.itemImageUrl = orderObj.imagePath;
    }
    
    // Also ensure item-level images have both fields for consistency
    if (orderObj.items && Array.isArray(orderObj.items)) {
      orderObj.items = orderObj.items.map(item => {
        if (item.imagePath && !item.itemImageUrl) {
          item.itemImageUrl = item.imagePath;
        }
        if (item.itemImageUrl && !item.imagePath) {
          item.imagePath = item.itemImageUrl;
        }
        return item;
      });
    }
    
    // Emit socket event for order update after item confirmation
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('orders:updated', orderObj);
        io.emit('notifications:push', {
          type: 'item_confirmed',
          orderId: orderObj.id || orderObj._id,
          orderNumber: orderObj.orderNumber,
          message: `Item ${itemIndex} confirmed in order ${orderObj.orderNumber}`,
          at: new Date().toISOString()
        });
      }
    } catch {}

    res.json({ 
      success: true, 
      message: `Item confirmed and ${item.quantity} units added to stock`,
      data: orderObj,
      stockUpdate: {
        productId: item.productId,
        productName: product.name,
        previousStock: product.stock - item.quantity,
        newStock: newStock,
        addedQuantity: item.quantity
      }
    });
  } catch (error) {
    console.error('Confirm item error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Upload image for specific item in order
router.post('/:id/item/:itemIndex/image', [authenticateUserOrVendor, upload.single('image')], async (req, res) => {
  try {
    console.log('Item image upload request:', {
      orderId: req.params.id,
      itemIndex: req.params.itemIndex,
      userType: req.userType,
      vendorId: req.vendor?._id,
      userId: req.user?._id,
      hasFile: !!req.file
    });
    
    const order = await Order.findById(req.params.id);
    
    if (!order || !order.isActive) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const itemIndex = parseInt(req.params.itemIndex);
    
    // Validate item index
    if (isNaN(itemIndex) || itemIndex < 0 || itemIndex >= order.items.length) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid item index. Order has ${order.items.length} items.` 
      });
    }

    // If user is a vendor, allow them to upload images to any order
    // (Remove this restriction temporarily for testing)
    // TODO: Restore proper vendor authorization based on business requirements
    if (req.userType === 'vendor') {
      console.log('Vendor uploading item image:', {
        vendorId: req.vendor._id,
        orderVendorId: order.vendorId,
        orderId: order._id,
        itemIndex: itemIndex
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    // Update the specific item with image path
    const imagePath = `/upload/${req.file.filename}`;
    order.items[itemIndex].imagePath = imagePath;
    order.items[itemIndex].itemImageUrl = imagePath; // Also save to itemImageUrl for backward compatibility
    
    console.log('Saving order with item image:', {
      orderId: order._id,
      itemIndex: itemIndex,
      imagePath: order.items[itemIndex].imagePath,
      itemImageUrl: order.items[itemIndex].itemImageUrl
    });
    
    // Mark the items array as modified
    order.markModified('items');
    await order.save();
    
    console.log('Order saved successfully with item image');
    
    // Also append this image to the related product's images (newest first)
    try {
      const productId = order.items[itemIndex]?.productId;
      if (productId) {
        const product = await Product.findById(productId);
        if (product && product.isActive !== false) {
          const images = Array.isArray(product.images) ? product.images : [];
          if (!images.includes(imagePath)) images.unshift(imagePath);
          product.images = images;
          await product.save();
          try {
            const io = req.app.get('io');
            if (io) io.emit('products:updated', { id: String(product._id), images: product.images });
          } catch {}
          console.log('Appended image to product.images:', { productId: String(product._id), imagePath });
        }
      }
    } catch (e) {
      console.error('Failed to append image to product.images', e);
    }

    // Fetch the updated order to emit a full payload
    let fullAfterItemImage = null;
    try {
      const o = await Order.findById(order._id).populate([
        { path: 'vendorId', select: 'name contactPerson email' },
        { path: 'items.productId', select: 'name itemNumber images' }
      ]);
      if (o) {
        const oObj = o.toObject();
        if (oObj.imagePath && !oObj.itemImageUrl) oObj.itemImageUrl = oObj.imagePath;
        if (oObj.itemImageUrl && !oObj.imagePath) oObj.imagePath = oObj.itemImageUrl;
        if (oObj.items && Array.isArray(oObj.items)) {
          oObj.items = oObj.items.map(it => {
            if (it.imagePath && !it.itemImageUrl) it.itemImageUrl = it.imagePath;
            if (it.itemImageUrl && !it.imagePath) it.imagePath = it.itemImageUrl;
            return it;
          });
        }
        fullAfterItemImage = oObj;
      }
    } catch {}

    // Emit socket event for order update due to item image upload (full payload when possible)
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('orders:updated', fullAfterItemImage || { id: order._id, itemIndex, itemImageUrl: imagePath, imagePath });
        io.emit('notifications:push', {
          type: 'item_image_uploaded',
          orderId: (fullAfterItemImage?.id || order._id),
          orderNumber: fullAfterItemImage?.orderNumber,
          message: `Image uploaded for item ${itemIndex} in order ${fullAfterItemImage?.orderNumber || ''}`,
          at: new Date().toISOString()
        });
      }
    } catch {}

    res.json({ 
      success: true, 
      message: 'Item image uploaded successfully',
      data: { 
        itemImageUrl: imagePath,
        imagePath: imagePath,
        itemIndex: itemIndex
      }
    });
  } catch (error) {
    console.error('Upload item image error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Upload image for order
router.post('/:id/image', [authenticateUserOrVendor, upload.single('image')], async (req, res) => {
  try {
    console.log('Image upload request:', {
      orderId: req.params.id,
      userType: req.userType,
      vendorId: req.vendor?._id,
      userId: req.user?._id,
      hasFile: !!req.file
    });
    
    const order = await Order.findById(req.params.id);
    
    if (!order || !order.isActive) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // If user is a vendor, allow them to upload images to any order
    // (Remove this restriction temporarily for testing)
    // TODO: Restore proper vendor authorization based on business requirements
    if (req.userType === 'vendor') {
      console.log('Vendor uploading image:', {
        vendorId: req.vendor._id,
        orderVendorId: order.vendorId,
        orderId: order._id
      });
      // Temporarily allow all vendors to upload to any order
      // if (order.vendorId && order.vendorId.toString() !== req.vendor._id.toString()) {
      //   return res.status(403).json({ success: false, message: 'Access denied. You can only upload images to orders assigned to you.' });
      // }
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    // Update order with image path
    const imagePath = `/upload/${req.file.filename}`;
    order.imagePath = imagePath;
    order.itemImageUrl = imagePath; // Also save to itemImageUrl for backward compatibility
    
    console.log('Saving order with image:', {
      orderId: order._id,
      imagePath: order.imagePath,
      itemImageUrl: order.itemImageUrl
    });
    
    await order.save();
    
    console.log('Order saved successfully');

    // Fetch the updated order to emit a full payload
    let fullAfterOrderImage = null;
    try {
      const o = await Order.findById(order._id).populate([
        { path: 'vendorId', select: 'name contactPerson email' },
        { path: 'items.productId', select: 'name itemNumber images' }
      ]);
      if (o) {
        const oObj = o.toObject();
        if (oObj.imagePath && !oObj.itemImageUrl) oObj.itemImageUrl = oObj.imagePath;
        if (oObj.itemImageUrl && !oObj.imagePath) oObj.imagePath = oObj.itemImageUrl;
        if (oObj.items && Array.isArray(oObj.items)) {
          oObj.items = oObj.items.map(it => {
            if (it.imagePath && !it.itemImageUrl) it.itemImageUrl = it.imagePath;
            if (it.itemImageUrl && !it.imagePath) it.imagePath = it.itemImageUrl;
            return it;
          });
        }
        fullAfterOrderImage = oObj;
      }
    } catch {}

    // Emit socket event for order update due to order image upload (full payload when possible)
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('orders:updated', fullAfterOrderImage || { id: order._id, itemImageUrl: imagePath, imagePath });
        io.emit('notifications:push', {
          type: 'order_image_uploaded',
          orderId: (fullAfterOrderImage?.id || order._id),
          orderNumber: fullAfterOrderImage?.orderNumber,
          message: `Order image uploaded for ${fullAfterOrderImage?.orderNumber || ''}`,
          at: new Date().toISOString()
        });
      }
    } catch {}

    res.json({ 
      success: true, 
      message: 'Image uploaded successfully',
      data: { 
        itemImageUrl: imagePath,
        imagePath: imagePath 
      }
    });
  } catch (error) {
    console.error('Upload order image error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
