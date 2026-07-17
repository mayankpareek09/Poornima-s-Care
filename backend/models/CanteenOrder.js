const mongoose = require('mongoose');
const { nextSequence } = require('./Counter');

async function generateToken() {
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  // Atomic per-day counter — safe under concurrent checkouts, unlike the previous
  // countDocuments() snapshot which could hand two simultaneous orders the same token.
  const seq = await nextSequence(`canteen-${today}`);
  return `CAN-${today}-${String(seq).padStart(4,'0')}`;
}

const orderItemSchema = new mongoose.Schema({
  itemId:   { type: mongoose.Schema.Types.ObjectId, ref: 'CanteenItem', required: true },
  name:     { type: String, required: true },
  price:    { type: Number, required: true },
  qty:      { type: Number, required: true, min: 1, max: 10 },
  subtotal: { type: Number, required: true },
}, { _id: false });

const canteenOrderSchema = new mongoose.Schema({
  token:         { type: String, unique: true },
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  studentName:   { type: String, required: true },
  studentUserId: { type: String, required: true },
  items:         [orderItemSchema],
  total:         { type: Number, required: true },
  status:        { type: String, enum: ['paid','preparing','ready','collected','cancelled'], default: 'paid' },
  paymentMode:   { type: String, enum: ['simulated','upi','card'], default: 'simulated' },
  estimatedMins: { type: Number, default: 10 },
  note:          { type: String, default: '' },
  collectedAt:   { type: Date },
}, { timestamps: true });

canteenOrderSchema.pre('save', async function(next) {
  if (!this.token) this.token = await generateToken();
  next();
});

module.exports = mongoose.model('CanteenOrder', canteenOrderSchema);