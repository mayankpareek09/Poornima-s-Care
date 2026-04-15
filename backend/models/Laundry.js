const mongoose = require('mongoose');

const washEntrySchema = new mongoose.Schema({
  washNo:       { type: Number, required: true },
  clothesDesc:  { type: String, default: '' },
  submittedAt:  { type: Date },
  collectedAt:  { type: Date },
  status:       { type: String, enum: ['submitted','washing','ready','collected'], default: 'submitted' },
  adminNotes:   { type: String, default: '' },
}, { _id: true });

const laundrySchema = new mongoose.Schema({
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  studentName:   { type: String, required: true },
  studentUserId: { type: String, required: true },
  hostel:        { type: String, default: '' },
  room:          { type: String, default: '' },
  totalWashes:   { type: Number, default: 30 },
  usedWashes:    { type: Number, default: 0 },
  // Current active bag status
  currentStatus: { type: String, enum: ['idle','submitted','washing','ready'], default: 'idle' },
  currentClothesDesc: { type: String, default: '' },
  currentSubmittedAt: { type: Date },
  currentWashEntryId: { type: mongoose.Schema.Types.ObjectId, default: null },
  // Full history
  washHistory:   [washEntrySchema],
  adminNotes:    { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Laundry', laundrySchema);
