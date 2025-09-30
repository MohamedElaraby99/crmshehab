const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    itemNumber: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    unitPrice: {
      type: Number,
      required: false,
      min: 0,
      default: undefined
    },
    totalPrice: {
      type: Number,
      required: false,
      min: 0,
      default: undefined
    },
    // Item-level price approval status
    priceApprovalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    // Item-level price approval rejection reason
    priceApprovalRejectionReason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    // Item-level status
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'pending'
    },
    // Item-level notes
    notes: {
      type: String,
      trim: true,
      maxlength: 500
    },
    // Item-level estimated ready date
    estimatedDateReady: {
      type: String,
      trim: true,
      maxlength: 100
    },
    // Item-level confirm form shehab
    confirmFormShehab: {
      type: String,
      trim: true,
      maxlength: 100
    },
    // Item-level invoice number
    invoiceNumber: {
      type: String,
      trim: true,
      maxlength: 100
    },
    // Item-level transfer amount
    transferAmount: {
      type: Number,
      min: 0
    },
    // Item-level shipping date to agent
    shippingDateToAgent: {
      type: String,
      trim: true,
      maxlength: 100
    },
    // Item-level shipping date to Saudi
    shippingDateToSaudi: {
      type: String,
      trim: true,
      maxlength: 100
    },
    // Item-level arrival date
    arrivalDate: {
      type: String,
      trim: true,
      maxlength: 100
    },
    // Item-level additional fields
    isActive: {
      type: Boolean,
      default: true
    },
    stockAdjusted: {
      type: Boolean,
      default: false
    },
    orderDate: {
      type: Date,
      default: Date.now
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    price: {
      type: Number,
      min: 0
    },
    totalAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    imagePath: {
      type: String,
      trim: true,
      maxlength: 500
    },
    itemImageUrl: {
      type: String,
      trim: true,
      maxlength: 500
    }
  }],
  totalAmount: {
    type: Number,
    required: false,
    min: 0,
    default: undefined
  },
  price: {
    type: Number,
    required: false,
    min: 0,
    default: undefined
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  confirmFormShehab: {
    type: String,
    trim: true,
    maxlength: 500
  },
  estimatedDateReady: {
    type: String,
    trim: true,
    maxlength: 100
  },
  invoiceNumber: {
    type: String,
    trim: true,
    maxlength: 100
  },
  transferAmount: {
    type: Number,
    min: 0
  },
  shippingDateToAgent: {
    type: String,
    trim: true,
    maxlength: 100
  },
  shippingDateToSaudi: {
    type: String,
    trim: true,
    maxlength: 100
  },
  arrivalDate: {
    type: String,
    trim: true,
    maxlength: 100
  },
  shippingAddress: {
    street: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    zipCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, trim: true, maxlength: 100 }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  imagePath: {
    type: String,
    trim: true,
    maxlength: 500
  },
  itemImageUrl: {
    type: String,
    trim: true,
    maxlength: 500
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  expectedDeliveryDate: {
    type: String,
    trim: true,
    maxlength: 100
  },
  actualDeliveryDate: {
    type: String,
    trim: true,
    maxlength: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  stockAdjusted: {
    type: Boolean,
    default: false
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

orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for better search performance
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ vendorId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderDate: -1 });

// Transform _id to id in JSON output
orderSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Order', orderSchema);
