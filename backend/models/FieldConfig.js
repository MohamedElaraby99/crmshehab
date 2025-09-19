const mongoose = require('mongoose');

const fieldConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  label: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'number', 'date', 'select', 'textarea']
  },
  required: {
    type: Boolean,
    default: false
  },
  editableBy: {
    type: String,
    required: true,
    enum: ['admin', 'vendor', 'both']
  },
  visibleTo: {
    type: String,
    required: true,
    enum: ['admin', 'vendor', 'both']
  },
  placeholder: {
    type: String,
    default: ''
  },
  options: [{
    value: String,
    label: String
  }],
  validation: {
    min: Number,
    max: Number,
    pattern: String
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Transform _id to id and remove __v
fieldConfigSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('FieldConfig', fieldConfigSchema);
