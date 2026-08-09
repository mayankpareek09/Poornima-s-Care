const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  title:           { type: String, required: true, trim: true, maxlength: 200 },
  author:          { type: String, required: true, trim: true, maxlength: 150 },
  isbn:            { type: String, default: '', trim: true },
  category:        {
    type: String, default: 'Other',
    enum: ['Computer Science','Electronics','Mechanical','Civil','Mathematics','Physics',
           'Chemistry','Cyber Security','Management','Fiction','Reference','Competitive Exams','Other']
  },
  publisher:       { type: String, default: '' },
  edition:         { type: String, default: '' },
  totalCopies:     { type: Number, default: 1, min: 0 },
  availableCopies: { type: Number, default: 1, min: 0 },
  coverColor:      { type: String, default: '#0B2E33' }, // used for the placeholder cover swatch
  addedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

bookSchema.index({ title: 'text', author: 'text', isbn: 'text' });

module.exports = mongoose.model('Book', bookSchema);
