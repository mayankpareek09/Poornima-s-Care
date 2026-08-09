const mongoose = require('mongoose');

const medicalAppointmentSchema = new mongoose.Schema({
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName:   { type: String, required: true },
  studentUserId: { type: String, required: true },
  symptoms:      { type: String, required: true, maxlength: 500 },
  urgency:       { type: String, enum: ['routine', 'urgent'], default: 'routine' },
  preferredDate: { type: Date, required: true },
  status:        { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  doctorNotes:   { type: String, default: '' },
  confirmedSlot: { type: Date, default: null },
}, { timestamps: true });

medicalAppointmentSchema.index({ status: 1, preferredDate: 1 });

module.exports = mongoose.model('MedicalAppointment', medicalAppointmentSchema);
