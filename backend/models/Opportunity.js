const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema({
  type:         { type: String, enum: ['placement', 'internship'], required: true },
  company:      { type: String, required: true, trim: true, maxlength: 120 },
  role:         { type: String, required: true, trim: true, maxlength: 120 },
  description:  { type: String, default: '', maxlength: 1000 },
  // For placements this is CTC package, for internships it's stipend — kept as
  // free text since these vary a lot (e.g. "6 LPA", "₹15,000/month").
  compensation: { type: String, default: '' },
  location:     { type: String, default: '' },
  eligibility:  { type: String, default: '' }, // e.g. "CGPA 7+, B.Tech CSE/IT"
  driveDate:    { type: Date, default: null },
  deadline:     { type: Date, required: true },
  status:       { type: String, enum: ['open', 'closed'], default: 'open' },
  postedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

opportunitySchema.index({ type: 1, status: 1, deadline: 1 });

module.exports = mongoose.model('Opportunity', opportunitySchema);
