const mongoose = require('mongoose');

const scholarshipSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 150 },
  provider:    { type: String, default: '', trim: true }, // e.g. "State Govt", "University Merit Fund"
  amount:      { type: String, default: '' },              // free text — varies ("Full tuition", "₹25,000")
  eligibility: { type: String, default: '' },
  deadline:    { type: Date, required: true },
  applyInfo:   { type: String, default: '' }, // how to apply — external link or process description
  status:      { type: String, enum: ['open', 'closed'], default: 'open' },
  postedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

scholarshipSchema.index({ status: 1, deadline: 1 });

module.exports = mongoose.model('Scholarship', scholarshipSchema);
