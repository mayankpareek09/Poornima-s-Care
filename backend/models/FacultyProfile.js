const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  day:       { type: String, enum: ['Mon','Tue','Wed','Thu','Fri','Sat'], required: true },
  startTime: { type: String, required: true }, // e.g. "10:00 AM"
  endTime:   { type: String, required: true }, // e.g. "12:00 PM"
}, { _id: false });

const facultyProfileSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  facultyName:    { type: String, required: true },
  department:     { type: String, default: 'General' },
  designation:    { type: String, default: 'Faculty' },
  availableSlots: { type: [slotSchema], default: [] }, // weekly recurring slots
  isAcceptingAppointments: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('FacultyProfile', facultyProfileSchema);
