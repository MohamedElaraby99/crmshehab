const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  itemNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: false,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  images: [{
    type: String,
    trim: true
  }],
  specifications: {
    type: Map,
    of: String
  },
  sellingPrice: {
    type: Number,
    required: false,
    min: 0,
    default: undefined
  },
  reorderLevel: {
    type: Number,
    required: false,
    min: 0,
    default: 0
  },
  stock: {
    type: Number,
    required: true,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  visibleToClients: {
    type: Boolean,
    default: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: false // Allow admin-created products without vendorId
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt field
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better search performance
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ itemNumber: 1 });

// Transform _id to id in JSON output
productSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Product', productSchema);
