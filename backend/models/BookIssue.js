const mongoose = require('mongoose');

const bookIssueSchema = new mongoose.Schema({
  bookId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  bookTitle:     { type: String, required: true },
  studentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName:   { type: String, required: true },
  studentUserId: { type: String, required: true },
  issuedAt:      { type: Date, default: Date.now },
  dueDate:       { type: Date, required: true },
  returnedAt:    { type: Date, default: null },
  status:        { type: String, enum: ['issued', 'returned'], default: 'issued' },
  fineAmount:    { type: Number, default: 0 }, // ₹2/day after due date, computed at return time
  issuedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

bookIssueSchema.index({ studentId: 1, status: 1 });
bookIssueSchema.index({ status: 1, dueDate: 1 });

module.exports = mongoose.model('BookIssue', bookIssueSchema);
