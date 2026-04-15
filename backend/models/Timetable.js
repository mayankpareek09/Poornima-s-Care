const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  time:    { type: String, required: true },
  monday:  { type: String, default: '' },
  tuesday: { type: String, default: '' },
  wednesday:{ type: String, default: '' },
  thursday:{ type: String, default: '' },
  friday:  { type: String, default: '' },
  saturday:{ type: String, default: '' },
  type:    { type: String, enum: ['subject','break','lab','empty'], default: 'empty' },
}, { _id: false });

const timetableSchema = new mongoose.Schema({
  course:    { type: String, required: true },
  semester:  { type: String, required: true },
  section:   { type: String, default: 'A' },
  slots:     [slotSchema],
  updatedBy: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Timetable', timetableSchema);
