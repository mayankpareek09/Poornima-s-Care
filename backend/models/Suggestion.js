const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  authorId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName:  { type: String, required: true }, // 'Anonymous' if isAnonymous is true
  isAnonymous: { type: Boolean, default: false },
  title:       { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 800 },
  category:    {
    type: String, default: 'Other',
    enum: ['Hostel','Mess','Academic','Canteen','Bus','Cleanliness','Library',
           'Sports','Internet','Security','Administration','Events','Other']
  },
  likes:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status:   { type: String, enum: ['open','under_review','implemented','rejected'], default: 'open' },
  adminNote:{ type: String, default: '' },
}, { timestamps: true });

// Virtual for net score — likes minus dislikes, used for ranking
suggestionSchema.virtual('score').get(function() {
  return (this.likes?.length || 0) - (this.dislikes?.length || 0);
});
suggestionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Suggestion', suggestionSchema);
