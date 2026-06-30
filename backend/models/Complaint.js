const mongoose = require('mongoose');

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

// Escalation level → who handles it
const ESCALATION_ROLES = ['campus_admin', 'hostel_admin', 'academic_admin'];

const escalationSchema = new mongoose.Schema({
  level:      { type: Number, required: true },
  escalatedTo:{ type: String, required: true },
  escalatedAt:{ type: Date, default: Date.now },
  reason:     { type: String, default: 'Auto-escalated: unresolved after 24 hours' },
}, { _id: false });

const complaintSchema = new mongoose.Schema({
  studentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  studentName:    { type: String, required: true },
  studentUserId:  { type: String, required: true },
  title:          { type: String, required: true, trim: true },
  category:       { type: String, required: true, enum: Object.keys(CATEGORY_ROUTING) },
  routedTo:       { type: String, enum: ['academic_admin','hostel_admin','campus_admin'], required: true },
  description:    { type: String, required: true, trim: true },
  priority:       { type: String, enum: ['Low','Medium','High','SOS'], default: 'Medium' },
  status:         { type: String, enum: ['open','inprogress','resolved'], default: 'open' },
  adminRemarks:   { type: String, default: '' },
  resolvedAt:     { type: Date },
  mediaUrl:       { type: String, default: '' },
  // SOS
  isSOS:          { type: Boolean, default: false },
  // Upvote
  upvotes:        { type: Number, default: 0 },
  upvotedBy:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Escalation
  escalationLevel:{ type: Number, default: 0 },
  escalationHistory: [escalationSchema],
  lastEscalatedAt:{ type: Date },
  isEscalated:    { type: Boolean, default: false },
}, { timestamps: true });

complaintSchema.statics.CATEGORY_ROUTING = CATEGORY_ROUTING;
complaintSchema.statics.ESCALATION_ROLES = ESCALATION_ROLES;

// Speeds up admin dashboards filtering by department + status, sorted by escalation/recency
complaintSchema.index({ routedTo: 1, status: 1, createdAt: -1 });
complaintSchema.index({ isEscalated: 1, status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);