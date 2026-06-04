const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema({
  items:  { type: String, default: '' },
  timing: { type: String, default: '' },
}, { _id: false });

const messMenuSchema = new mongoose.Schema({
  date:      { type: String, required: true, unique: true },
  breakfast: mealSchema,
  lunch:     mealSchema,
  snacks:    mealSchema,
  dinner:    mealSchema,
  notice:    { type: String, default: '' },
  postedBy:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('MessMenu', messMenuSchema);