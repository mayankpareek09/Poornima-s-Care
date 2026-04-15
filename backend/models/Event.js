const mongoose = require('mongoose');
const eventSchema = new mongoose.Schema({
  title:         { type: String, required: true, trim: true },
  description:   { type: String, default: '' },
  date:          { type: Date, required: true },
  time:          { type: String, default: '' },
  venue:         { type: String, default: '' },
  type:          { type: String, enum: ['academic','cultural','sports','club','general','exam','holiday'], default: 'general' },
  clubName:      { type: String, default: '' },
  isOngoing:     { type: Boolean, default: false },
  requirements:  { type: String, default: '' },
  allowedFor:    { type: String, default: 'All Students' },
  organizer:     { type: String, default: '' },
  photos:        [{ type: String }],
  createdBy:     { type: String },
  createdByRole: { type: String },
  createdById:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
module.exports = mongoose.model('Event', eventSchema);
