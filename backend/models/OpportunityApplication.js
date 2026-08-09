const mongoose = require('mongoose');

const opportunityApplicationSchema = new mongoose.Schema({
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName:   { type: String, required: true },
  studentUserId: { type: String, required: true },
  status:        { type: String, enum: ['applied', 'shortlisted', 'selected', 'rejected'], default: 'applied' },
  notes:         { type: String, default: '' }, // admin remarks
}, { timestamps: true });

opportunityApplicationSchema.index({ opportunityId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('OpportunityApplication', opportunityApplicationSchema);
