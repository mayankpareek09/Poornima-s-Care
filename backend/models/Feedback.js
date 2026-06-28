const mongoose = require('mongoose');

const CATEGORIES = [
  'hostel','mess','academic','canteen','bus',
  'cleanliness','library','sports','internet',
  'security','administration','events'
];

const feedbackSchema = new mongoose.Schema({
  studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentName: { type: String, required: true },
  month:       { type: String, required: true }, // 'YYYY-MM' — one feedback per student per month
  ratings:     {
    hostel:         { type: Number, min: 1, max: 5 },
    mess:           { type: Number, min: 1, max: 5 },
    academic:       { type: Number, min: 1, max: 5 },
    canteen:        { type: Number, min: 1, max: 5 },
    bus:            { type: Number, min: 1, max: 5 },
    cleanliness:    { type: Number, min: 1, max: 5 },
    library:        { type: Number, min: 1, max: 5 },
    sports:         { type: Number, min: 1, max: 5 },
    internet:       { type: Number, min: 1, max: 5 },
    security:       { type: Number, min: 1, max: 5 },
    administration: { type: Number, min: 1, max: 5 },
    events:         { type: Number, min: 1, max: 5 },
  },
  comment:     { type: String, default: '', trim: true, maxlength: 500 },
}, { timestamps: true });

// One feedback document per student per month
feedbackSchema.index({ studentId: 1, month: 1 }, { unique: true });
feedbackSchema.statics.CATEGORIES = CATEGORIES;

module.exports = mongoose.model('Feedback', feedbackSchema);
