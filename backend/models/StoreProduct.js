const mongoose = require('mongoose');

// type: 'store' = merchandise (T-shirts, uniform, etc), 'stationery' = books/ID card
const storeProductSchema = new mongoose.Schema({
  type:        { type: String, required: true, enum: ['store','stationery'], default: 'store' },
  name:        { type: String, required: true, trim: true },
  category:    { type: String, required: true }, // e.g. T-Shirt, Uniform, Hoodie / Lab Notebook, ID Card
  price:       { type: Number, required: true, min: 0 },
  description: { type: String, default: '', trim: true },
  sizes:       { type: [String], default: [] }, // e.g. ['S','M','L','XL','XXL'] — empty if not size-based
  stock:       { type: Number, default: 999 },  // simple stock counter
  isAvailable: { type: Boolean, default: true },
  imageEmoji:  { type: String, default: '🛍️' },
  sortOrder:   { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('StoreProduct', storeProductSchema);
