const mongoose = require('mongoose');

// ── Subject ──────────────────────────────────────
const subjectSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  code:    { type: String, required: true, trim: true },
}, { _id: true });

// ── Exam Schedule entry ───────────────────────────
const scheduleSchema = new mongoose.Schema({
  subjectId: { type: mongoose.Schema.Types.ObjectId },
  subjectName: { type: String },
  subjectCode: { type: String },
  date:   { type: String, required: true },   // "YYYY-MM-DD"
  time:   { type: String, required: true },   // "09:00 AM – 12:00 PM"
  room:   { type: String, default: '' },
}, { _id: true });

// ── Main document ─────────────────────────────────
const examCalendarSchema = new mongoose.Schema({
  department: { type: String, required: true, trim: true },   // e.g. "BTech", "MTech"
  year:       { type: String, required: true, trim: true },   // e.g. "1st Year", "2nd Year"
  examType:   { type: String, required: true, trim: true },   // e.g. "CIE 1", "MSE", "End Sem"
  subjects:   [subjectSchema],
  schedule:   [scheduleSchema],
  updatedBy:  { type: String },
}, { timestamps: true });

// Compound index so lookups are fast
examCalendarSchema.index({ department: 1, year: 1, examType: 1 });

module.exports = mongoose.model('ExamCalendar', examCalendarSchema);