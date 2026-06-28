const mongoose = require('mongoose');

async function generateOrderId(type) {
  const prefix = type === 'stationery' ? 'STA' : 'STR';
  const today  = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const count  = await mongoose.model('StoreOrder').countDocuments({
    type,
    createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
  });
  return `${prefix}-${today}-${String(count + 1).padStart(4,'0')}`;
}

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'StoreProduct', required: true },
  name:      { type: String, required: true },
  size:      { type: String, default: '' }, // empty if not size-based item
  price:     { type: Number, required: true },
  qty:       { type: Number, required: true, min: 1, max: 10 },
  subtotal:  { type: Number, required: true },
}, { _id: false });

const storeOrderSchema = new mongoose.Schema({
  type:          { type: String, required: true, enum: ['store','stationery'], default: 'store' },
  orderId:       { type: String, unique: true },
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName:   { type: String, required: true },
  studentUserId: { type: String, required: true },
  items:         [orderItemSchema],
  total:         { type: Number, required: true },
  status:        { type: String, enum: ['paid','processing','ready','collected','cancelled'], default: 'paid' },
  // ID card requests need extra info
  idCardReason:  { type: String, default: '' }, // 'lost' | 'new' | 'change' — only used for ID card items
  note:          { type: String, default: '' },
  collectedAt:   { type: Date },
}, { timestamps: true });

storeOrderSchema.pre('save', async function(next) {
  if (!this.orderId) this.orderId = await generateOrderId(this.type);
  next();
});

module.exports = mongoose.model('StoreOrder', storeOrderSchema);
