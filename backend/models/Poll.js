const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  question:      { type: String, required: true, trim: true, maxlength: 200 },
  options:       [{
    text:  { type: String, required: true, trim: true, maxlength: 100 },
    votes: { type: Number, default: 0 },
  }],
  createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByName: { type: String, required: true },
  createdByRole: { type: String, required: true },
  status:        { type: String, enum: ['active', 'closed'], default: 'active' },
  closesAt:      { type: Date, default: null }, // optional auto-close date
  // Every user who has voted, and which option index they picked — prevents
  // double voting and lets the frontend show "you voted for X".
  voters:        [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    option: { type: Number },
  }],
}, { timestamps: true });

pollSchema.virtual('totalVotes').get(function () {
  return (this.options || []).reduce((sum, o) => sum + (o.votes || 0), 0);
});
pollSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Poll', pollSchema);
