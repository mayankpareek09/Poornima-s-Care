const mongoose = require('mongoose');

const canteenItemSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  category:    { type: String, required: true, enum: ['Snacks','Drinks','Meals','Combos'] },
  price:       { type: Number, required: true, min: 0 },
  description: { type: String, default: '', trim: true },
  isVeg:       { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true },
  imageEmoji:  { type: String, default: '🍽️' },
  sortOrder:   { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('CanteenItem', canteenItemSchema);