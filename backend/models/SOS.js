const mongoose = require('mongoose');

const sosSchema = new mongoose.Schema({
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName:   { type: String, required: true },
  studentUserId: { type: String, required: true },
  phone:         { type: String, default: 'Not provided' },
  hostel:        { type: String, default: 'Not provided' },
  room:          { type: String, default: 'Not provided' },
  campus:        { type: String, default: 'Poornima University' },
  message:       { type: String, default: 'Emergency! Immediate assistance needed.' },
  status:        { type: String, enum: ['active', 'acknowledged', 'resolved'], default: 'active' },
  acknowledgedBy:{ type: String, default: '' },
  acknowledgedAt:{ type: Date },
  resolvedAt:    { type: Date },
  location:      { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('SOS', sosSchema);
