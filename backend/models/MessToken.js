const mongoose = require('mongoose');

async function generateToken(meal) {
  const mealCode = { breakfast:'B', lunch:'L', snacks:'S', dinner:'D' }[meal] || 'X';
  const today    = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const count    = await mongoose.model('MessToken').countDocuments({
    createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
  });
  return `MESS-${today}-${mealCode}-${String(count + 1).padStart(4,'0')}`;
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