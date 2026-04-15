const mongoose = require('mongoose');

// Category → which admin department handles it
const CATEGORY_ROUTING = {
  'Hostel':       'hostel_admin',
  'Food':         'hostel_admin',
  'Water':        'hostel_admin',
  'Security':     'hostel_admin',
  'Academic':     'academic_admin',
  'Timetable':    'academic_admin',
  'Faculty':      'academic_admin',
  'Electricity':  'campus_admin',
  'Cleanliness':  'campus_admin',
  'Facilities':   'campus_admin',
  'Transport':    'campus_admin',
  'Internet':     'campus_admin',
  'Other':        'campus_admin',
};

const complaintSchema = new mongoose.Schema({
  studentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName:    { type: String, required: true },
  studentUserId:  { type: String, required: true },
  title:          { type: String, required: true, trim: true },
  category:       {
    type: String, required: true,
    enum: Object.keys(CATEGORY_ROUTING)
  },
  // Automatically set based on category
  routedTo:       {
    type: String,
    enum: ['academic_admin','hostel_admin','campus_admin'],
    required: true
  },
  description:    { type: String, required: true, trim: true },
  priority:       { type: String, enum: ['Low','Medium','High'], default: 'Medium' },
  status:         { type: String, enum: ['open','inprogress','resolved'], default: 'open' },
  adminRemarks:   { type: String, default: '' },
  resolvedAt:     { type: Date },
  mediaUrl:       { type: String, default: '' },
}, { timestamps: true });

complaintSchema.statics.CATEGORY_ROUTING = CATEGORY_ROUTING;

module.exports = mongoose.model('Complaint', complaintSchema);
