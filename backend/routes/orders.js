const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { authenticateUser, authenticateVendor, authenticateUserOrVendor } = require('../middleware/auth');

const router = express.Router();

// Get all orders
router.get('/', authenticateUserOrVendor, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      searchType = 'all',
      status,
      supplierId,
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

    if (supplierId) {
      query.supplierId = supplierId;
    }

    if (vendorId) {
      query.vendorId = vendorId;
    }

    // If user is a vendor, only show their orders
    if (req.userType === 'vendor') {
      query.vendorId = req.vendor._id;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Handle item count filtering
    let finalQuery = { ...query };
    let itemCountFilter = null;
    
    if (finalQuery._itemCountFilter) {
      itemCountFilter = finalQuery._itemCountFilter;
      delete finalQuery._itemCountFilter;
    }

    const orders = await Order.find(finalQuery)
      .populate('vendorId', 'name contactPerson email')
      .populate('items.productId', 'name itemNumber')
      .sort(sortOptions);

    // Filter by item count if needed
    let filteredOrders = orders;
    if (itemCountFilter !== null) {
      filteredOrders = orders.filter(order => order.items.length === itemCountFilter);
    }

    // Apply pagination to filtered results
    const total = filteredOrders.length;
    const paginatedOrders = filteredOrders
      .slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: paginatedOrders,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get order by ID
router.get('/:id', authenticateUserOrVendor, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('supplierId', 'name contactPerson email phone address')
      .populate('vendorId', 'name contactPerson email phone address')
      .populate('items.productId', 'name itemNumber description');

    if (!order || !order.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // If user is a vendor, ensure they can only access their own orders
    if (req.userType === 'vendor' && order.vendorId.toString() !== req.vendor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own orders.'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create order
router.post('/', [
  authenticateUserOrVendor,
  body('supplierId').isMongoId().withMessage('Valid supplier ID is required'),
  body('vendorId').isMongoId().withMessage('Valid vendor ID is required'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').isMongoId().withMessage('Valid product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.unitPrice').isNumeric().withMessage('Unit price must be a number')
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

    const { supplierId, vendorId, items, shippingAddress, notes, expectedDeliveryDate, orderNumber: providedOrderNumber, confirmFormShehab } = req.body;

    // Use provided order number or generate one
    const orderNumber = providedOrderNumber || `ORD-${String(Date.now()).slice(-6)}`;

    // Calculate total amount
    let totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.productId} not found`
        });
      }

      const totalPrice = item.quantity * item.unitPrice;
      totalAmount += totalPrice;

      processedItems.push({
        productId: item.productId,
        itemNumber: product.itemNumber,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice
      });
    }

    const order = new Order({
      orderNumber,
      supplierId,
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
      { path: 'supplierId', select: 'name contactPerson email' },
      { path: 'vendorId', select: 'name contactPerson email' },
      { path: 'items.productId', select: 'name itemNumber' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update order
router.put('/:id', [
  authenticateUserOrVendor,
  body('status').optional().isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid status'),
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
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order || !order.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // If user is a vendor, ensure they can only update their own orders
    if (req.userType === 'vendor' && order.vendorId.toString() !== req.vendor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own orders.'
      });
    }

    const updateData = {};
    if (req.body.status) updateData.status = req.body.status;
    if (req.body.confirmFormShehab !== undefined) updateData.confirmFormShehab = req.body.confirmFormShehab;
    if (req.body.estimatedDateReady !== undefined) updateData.estimatedDateReady = req.body.estimatedDateReady;
    if (req.body.invoiceNumber !== undefined) updateData.invoiceNumber = req.body.invoiceNumber;
    if (req.body.transferAmount !== undefined) updateData.transferAmount = req.body.transferAmount;
    if (req.body.shippingDateToAgent !== undefined) updateData.shippingDateToAgent = req.body.shippingDateToAgent;
    if (req.body.shippingDateToSaudi !== undefined) updateData.shippingDateToSaudi = req.body.shippingDateToSaudi;
    if (req.body.arrivalDate !== undefined) updateData.arrivalDate = req.body.arrivalDate;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    if (req.body.expectedDeliveryDate) updateData.expectedDeliveryDate = req.body.expectedDeliveryDate;
    if (req.body.actualDeliveryDate) updateData.actualDeliveryDate = req.body.actualDeliveryDate;

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'supplierId', select: 'name contactPerson email' },
      { path: 'vendorId', select: 'name contactPerson email' },
      { path: 'items.productId', select: 'name itemNumber' }
    ]);

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete order (soft delete)
router.delete('/:id', authenticateUserOrVendor, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order || !order.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // If user is a vendor, ensure they can only delete their own orders
    if (req.userType === 'vendor' && order.vendorId.toString() !== req.vendor._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only delete your own orders.'
      });
    }

    const deletedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get vendor orders
router.get('/vendor/:vendorId', authenticateVendor, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { 
      vendorId: req.params.vendorId,
      isActive: true 
    };

    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('supplierId', 'name contactPerson email')
      .populate('items.productId', 'name itemNumber')
      .sort({ orderDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

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
    console.error('Get vendor orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
