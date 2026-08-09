const mongoose = require('mongoose');

const campusLocationSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 120 },
  category:    {
    type: String, default: 'Other',
    enum: ['Academic Block','Hostel','Dining','Sports','Library','Administration','Medical','Parking','Other']
  },
  block:       { type: String, default: '' },   // e.g. "Block A", "Himalaya Hostel"
  floor:       { type: String, default: '' },
  description: { type: String, default: '', maxlength: 400 },
  hours:       { type: String, default: '' },   // e.g. "8:00 AM – 8:00 PM"
  icon:        { type: String, default: '📍' },
  addedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

campusLocationSchema.index({ category: 1 });

module.exports = mongoose.model('CampusLocation', campusLocationSchema);
