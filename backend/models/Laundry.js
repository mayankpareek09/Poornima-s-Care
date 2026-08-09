const mongoose = require('mongoose');

// Full pipeline: submitted (student requested) -> collected (staff picked up dirty
// bag) -> washing -> drying -> ironing -> ready -> out_for_delivery -> delivered
// (student has clean clothes back, wash count increments).
const STATUS_STEPS = ['submitted','collected','washing','drying','ironing','ready','out_for_delivery','delivered'];

const washEntrySchema = new mongoose.Schema({
  washNo:       { type: Number, required: true },
  clothesDesc:  { type: String, default: '' },
  submittedAt:  { type: Date },
  status:       { type: String, enum: STATUS_STEPS, default: 'submitted' },
  adminNotes:   { type: String, default: '' },
  estimatedCompletion: { type: Date },
  // Timestamp recorded the moment each stage was reached, so the student sees
  // a real timeline instead of just the current status.
  stageTimestamps: { type: Map, of: Date, default: {} },
}, { _id: true });

const laundrySchema = new mongoose.Schema({
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  studentName:   { type: String, required: true },
  studentUserId: { type: String, required: true },
  hostel:        { type: String, default: '' },
  room:          { type: String, default: '' },
  totalWashes:   { type: Number, default: 30 },
  usedWashes:    { type: Number, default: 0 },
  // Unique QR-encodable code for this student's bag — generated once, reused
  // for every wash cycle. Laundry admin scans this to pull up the record.
  bagCode:       { type: String, unique: true, sparse: true },
  // Current active bag status ('idle' = no bag in the system right now)
  currentStatus: { type: String, enum: ['idle', ...STATUS_STEPS], default: 'idle' },
  currentClothesDesc: { type: String, default: '' },
  currentSubmittedAt: { type: Date },
  currentEstimatedCompletion: { type: Date },
  currentWashEntryId: { type: mongoose.Schema.Types.ObjectId, default: null },
  // Full history
  washHistory:   [washEntrySchema],
  adminNotes:    { type: String, default: '' },
}, { timestamps: true });

laundrySchema.statics.STATUS_STEPS = STATUS_STEPS;

module.exports = mongoose.model('Laundry', laundrySchema);
