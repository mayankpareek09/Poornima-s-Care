const mongoose = require('mongoose');
const { nextSequence } = require('./Counter');

async function generateToken(meal) {
  const mealCode = { breakfast:'B', lunch:'L', snacks:'S', dinner:'D' }[meal] || 'X';
  const today    = new Date().toISOString().slice(0,10).replace(/-/g,'');
  // Atomic per-day counter (shared across meals, matching prior behavior) —
  // see Counter.js for why this replaces countDocuments().
  const seq = await nextSequence(`mess-${today}`);
  return `MESS-${today}-${mealCode}-${String(seq).padStart(4,'0')}`;
}

const messTokenSchema = new mongoose.Schema({
  token:       { type: String, unique: true },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName:    { type: String, required: true },
  userRegNo:   { type: String, required: true },
  userType:    { type: String, enum: ['day_scholar','staff'], required: true },
  meal:        { type: String, enum: ['breakfast','lunch','snacks','dinner'], required: true },
  date:        { type: String, required: true },
  price:       { type: Number, required: true },
  paymentMode: { type: String, default: 'simulated' },
  status:      { type: String, enum: ['active','used','expired'], default: 'active' },
  verifiedBy:  { type: String, default: '' },
  verifiedAt:  { type: Date },
}, { timestamps: true });

messTokenSchema.pre('save', async function(next) {
  if (!this.token) this.token = await generateToken(this.meal);
  next();
});

module.exports = mongoose.model('MessToken', messTokenSchema);