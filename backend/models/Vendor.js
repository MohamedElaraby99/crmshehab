const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  contactPerson: {
    type: String,
    required: false,
    trim: true,
    maxlength: 100
  },
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: false,
    trim: true,
    maxlength: 20
  },
  address: {
    type: String,
    required: false,
    trim: true,
    maxlength: 200
  },
  city: {
    type: String,
    required: false,
    trim: true,
    maxlength: 50
  },
  country: {
    type: String,
    required: false,
    trim: true,
    maxlength: 50
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastOnlineAt: {
    type: Date,
    default: null
  },
  lastOrdersReadAt: {
    type: Date,
    default: null
  }
});

// Normalize email: convert empty strings to null for sparse index
vendorSchema.pre('save', function(next) {
  // Convert empty email strings to null to work with sparse unique index
  if (this.email === '' || (typeof this.email === 'string' && this.email.trim() === '')) {
    this.email = null;
  }
  this.updatedAt = Date.now();
  next();
});

// Transform _id to id in JSON output
vendorSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Vendor', vendorSchema);
