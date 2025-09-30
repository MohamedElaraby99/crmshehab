const mongoose = require('mongoose');

const whatsappRecipientSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('WhatsAppRecipient', whatsappRecipientSchema);


