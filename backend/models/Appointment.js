const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  studentId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName:       { type: String, required: true },
  studentUserId:     { type: String, required: true },

  facultyId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  facultyName:        { type: String, required: true },

  date:              { type: String, required: true }, // YYYY-MM-DD
  day:               { type: String, required: true },  // Mon/Tue/...
  timeSlot:          { type: String, required: true },  // "10:00 AM - 11:00 AM"
  reason:            { type: String, required: true, trim: true, maxlength: 300 },

  status:            { type: String, enum: ['pending','accepted','rejected','cancelled'], default: 'pending' },
  facultyResponse:   { type: String, default: '' }, // reason for accept/reject
  respondedAt:       { type: Date },
}, { timestamps: true });

// Prevent double-booking the exact same faculty + date + slot while pending/accepted
appointmentSchema.index({ facultyId: 1, date: 1, timeSlot: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
