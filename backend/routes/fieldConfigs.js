const express = require('express');
const { body, validationResult } = require('express-validator');
const FieldConfig = require('../models/FieldConfig');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all field configurations
router.get('/all', authenticateUser, async (req, res) => {
  try {
    console.log('GET field configs - fetching all field configurations');
    
    const configs = await FieldConfig.find({ isActive: true })
      .sort({ order: 1, name: 1 });

    console.log(`GET field configs - found ${configs.length} configurations`);

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Get field configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all field configurations (root route)
router.get('/', authenticateUser, async (req, res) => {
  try {
    console.log('GET field configs - fetching all field configurations');
    
    const configs = await FieldConfig.find({ isActive: true })
      .sort({ order: 1, name: 1 });

    console.log(`GET field configs - found ${configs.length} configurations`);

    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error('Get field configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get field configuration by name
router.get('/name/:name', authenticateUser, async (req, res) => {
  try {
    const { name } = req.params;
    console.log(`GET field config by name: ${name}`);

    const config = await FieldConfig.findOne({ name, isActive: true });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Field configuration not found'
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Get field config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new field configuration (Admin only)
router.post('/', [
  authenticateUser,
  requireAdmin,
  body('name').trim().notEmpty().withMessage('Field name is required'),
  body('label').trim().notEmpty().withMessage('Field label is required'),
  body('type').isIn(['text', 'number', 'date', 'select', 'textarea']).withMessage('Invalid field type'),
  body('editableBy').isIn(['admin', 'vendor', 'both']).withMessage('Invalid editableBy value'),
  body('visibleTo').isIn(['admin', 'vendor', 'both']).withMessage('Invalid visibleTo value'),
  body('required').optional().isBoolean().withMessage('Required must be boolean'),
  body('placeholder').optional().trim(),
  body('options').optional().isArray().withMessage('Options must be an array'),
  body('validation.min').optional().isNumeric().withMessage('Validation min must be numeric'),
  body('validation.max').optional().isNumeric().withMessage('Validation max must be numeric'),
  body('validation.pattern').optional().trim(),
  body('order').optional().isInt().withMessage('Order must be an integer')
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

    console.log('POST field config - creating new field configuration:', req.body.name);

    // Check if field with same name already exists
    const existingConfig = await FieldConfig.findOne({ name: req.body.name });
    if (existingConfig) {
      return res.status(409).json({
        success: false,
        message: 'Field configuration with this name already exists'
      });
    }

    const fieldConfig = new FieldConfig(req.body);
    await fieldConfig.save();

    console.log('Field configuration created successfully:', fieldConfig.name);

    res.status(201).json({
      success: true,
      message: 'Field configuration created successfully',
      data: fieldConfig
    });
  } catch (error) {
    console.error('Create field config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update field configuration (Admin only)
router.put('/name/:name', [
  authenticateUser,
  requireAdmin,
  body('label').optional().trim().notEmpty().withMessage('Field label cannot be empty'),
  body('type').optional().isIn(['text', 'number', 'date', 'select', 'textarea']).withMessage('Invalid field type'),
  body('editableBy').optional().isIn(['admin', 'vendor', 'both']).withMessage('Invalid editableBy value'),
  body('visibleTo').optional().isIn(['admin', 'vendor', 'both']).withMessage('Invalid visibleTo value'),
  body('required').optional().isBoolean().withMessage('Required must be boolean'),
  body('placeholder').optional().trim(),
  body('options').optional().isArray().withMessage('Options must be an array'),
  body('validation.min').optional().isNumeric().withMessage('Validation min must be numeric'),
  body('validation.max').optional().isNumeric().withMessage('Validation max must be numeric'),
  body('validation.pattern').optional().trim(),
  body('order').optional().isInt().withMessage('Order must be an integer'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
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

    const { name } = req.params;
    console.log(`PUT field config - updating field configuration: ${name}`);

    // Filter allowed fields for update
    const allowedFields = [
      'label', 'type', 'editableBy', 'visibleTo', 'required', 
      'placeholder', 'options', 'validation', 'order', 'isActive'
    ];
    
    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const config = await FieldConfig.findOneAndUpdate(
      { name, isActive: true },
      updateData,
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Field configuration not found'
      });
    }

    console.log('Field configuration updated successfully:', config.name);

    res.json({
      success: true,
      message: 'Field configuration updated successfully',
      data: config
    });
  } catch (error) {
    console.error('Update field config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Bulk update field configurations (Admin only)
router.put('/bulk', [
  authenticateUser,
  requireAdmin,
  body('configs').isArray().withMessage('Configs must be an array'),
  body('configs.*.name').notEmpty().withMessage('Field name is required'),
  body('configs.*.editableBy').isIn(['admin', 'vendor', 'both']).withMessage('Invalid editableBy value'),
  body('configs.*.visibleTo').isIn(['admin', 'vendor', 'both']).withMessage('Invalid visibleTo value')
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

    const { configs } = req.body;
    console.log(`PUT field configs bulk - updating ${configs.length} configurations`);

    const updatePromises = configs.map(async (config) => {
      const allowedFields = ['editableBy', 'visibleTo', 'required', 'order'];
      const updateData = {};
      
      allowedFields.forEach(field => {
        if (config[field] !== undefined) {
          updateData[field] = config[field];
        }
      });

      return FieldConfig.findOneAndUpdate(
        { name: config.name, isActive: true },
        updateData,
        { new: true, runValidators: true }
      );
    });

    const updatedConfigs = await Promise.all(updatePromises);
    const validConfigs = updatedConfigs.filter(config => config !== null);

    console.log(`Bulk update completed - ${validConfigs.length} configurations updated`);

    res.json({
      success: true,
      message: `${validConfigs.length} field configurations updated successfully`,
      data: validConfigs
    });
  } catch (error) {
    console.error('Bulk update field configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete field configuration (Admin only)
router.delete('/name/:name', [authenticateUser, requireAdmin], async (req, res) => {
  try {
    const { name } = req.params;
    console.log(`DELETE field config - soft deleting field configuration: ${name}`);

    const config = await FieldConfig.findOneAndUpdate(
      { name, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Field configuration not found'
      });
    }

    console.log('Field configuration soft deleted successfully:', config.name);

    res.json({
      success: true,
      message: 'Field configuration deleted successfully'
    });
  } catch (error) {
    console.error('Delete field config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Reset field configurations to defaults (Admin only)
router.post('/reset', [authenticateUser, requireAdmin], async (req, res) => {
  try {
    console.log('POST field configs reset - resetting to default configurations');

    // Define default configurations
    const defaultConfigs = [
      {
        name: 'itemNumber',
        label: 'Item Number',
        type: 'text',
        required: true,
        editableBy: 'admin',
        visibleTo: 'both',
        placeholder: 'e.g., 68240575AB(iron)',
        order: 1
      },
      {
        name: 'productName',
        label: 'Product Name',
        type: 'text',
        required: true,
        editableBy: 'admin',
        visibleTo: 'both',
        placeholder: 'Product description',
        order: 2
      },
      {
        name: 'quantity',
        label: 'Quantity',
        type: 'number',
        required: true,
        editableBy: 'admin',
        visibleTo: 'both',
        validation: { min: 1 },
        order: 3
      },
      {
        name: 'price',
        label: 'Price ($)',
        type: 'number',
        required: false,
        editableBy: 'admin',
        visibleTo: 'admin',
        validation: { min: 0 },
        order: 4
      },
      {
        name: 'vendorId',
        label: 'Vendor',
        type: 'select',
        required: true,
        editableBy: 'admin',
        visibleTo: 'both',
        order: 5
      },
      {
        name: 'confirmFormShehab',
        label: 'Confirm Form Shehab',
        type: 'text',
        required: false,
        editableBy: 'admin',
        visibleTo: 'both',
        placeholder: 'e.g., Dec.20th, Nov.08',
        order: 6
      },
      {
        name: 'estimatedDateReady',
        label: 'Estimated Date to be Ready',
        type: 'date',
        required: false,
        editableBy: 'vendor',
        visibleTo: 'both',
        placeholder: 'Vendor will fill this',
        order: 7
      },
      {
        name: 'invoiceNumber',
        label: 'Invoice Number',
        type: 'text',
        required: false,
        editableBy: 'vendor',
        visibleTo: 'both',
        placeholder: 'e.g., MS002',
        order: 8
      },
      {
        name: 'transferAmount',
        label: 'Transfer Amount ($)',
        type: 'number',
        required: false,
        editableBy: 'vendor',
        visibleTo: 'both',
        validation: { min: 0 },
        order: 9
      },
      {
        name: 'shippingDateToAgent',
        label: 'Shipping Date to Agent',
        type: 'date',
        required: false,
        editableBy: 'vendor',
        visibleTo: 'both',
        order: 10
      },
      {
        name: 'shippingDateToSaudi',
        label: 'Shipping Date to Saudi Arabia',
        type: 'date',
        required: false,
        editableBy: 'vendor',
        visibleTo: 'both',
        order: 11
      },
      {
        name: 'arrivalDate',
        label: 'Arrival Date',
        type: 'date',
        required: false,
        editableBy: 'vendor',
        visibleTo: 'both',
        order: 12
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'textarea',
        required: false,
        editableBy: 'both',
        visibleTo: 'both',
        placeholder: 'Additional information',
        order: 13
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        required: false,
        editableBy: 'admin',
        visibleTo: 'both',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'confirmed', label: 'Confirmed' },
          { value: 'shipped', label: 'Shipped' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'cancelled', label: 'Cancelled' }
        ],
        order: 14
      }
    ];

    // Soft delete all existing configurations
    await FieldConfig.updateMany({}, { isActive: false });

    // Create new configurations
    const createdConfigs = await FieldConfig.insertMany(
      defaultConfigs.map(config => ({ ...config, isActive: true }))
    );

    console.log(`Reset completed - ${createdConfigs.length} default configurations created`);

    res.json({
      success: true,
      message: 'Field configurations reset to defaults successfully',
      data: createdConfigs
    });
  } catch (error) {
    console.error('Reset field configs error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
