const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  shortName:      { type: String, default: '' },
  description:    { type: String, default: '' },
  category:       { type: String, default: 'General' },
  icon:           { type: String, default: '🏫' },
  president:      { type: String, default: '' }, // captain name
  captain:        { type: String, default: '' },
  viceCaptain:    { type: String, default: '' },
  facultyAdvisor: { type: String, default: '' },
  members:        { type: Number, default: 0 },
  foundedYear:    { type: String, default: '' },
  contactEmail:   { type: String, default: '' },
  isActive:       { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Club', clubSchema);
