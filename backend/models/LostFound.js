const mongoose = require('mongoose');

const lostFoundSchema = new mongoose.Schema({
  reporterId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reporterName: { type: String, required: true },
  reporterUserId: { type: String, required: true },
  type:         { type: String, enum: ['lost', 'found'], required: true }, // lost = "I lost this", found = "I found this, unclaimed"
  itemName:     { type: String, required: true, trim: true, maxlength: 100 },
  description:  { type: String, default: '', trim: true, maxlength: 600 },
  category:     {
    type: String, default: 'Other',
    enum: ['Electronics','Books & Stationery','ID Card','Clothing','Accessories','Keys','Bag','Documents','Other']
  },
  location:     { type: String, default: '', trim: true, maxlength: 150 }, // where lost/found
  photo:        { type: String, default: '', maxlength: 2_000_000 }, // base64 or Cloudinary URL — route validates format/size before this is ever hit
  status:       { type: String, enum: ['open', 'claimed', 'closed'], default: 'open' },
  // Filled in when someone claims a "found" item, or when the reporter of a
  // "lost" item confirms they got it back.
  claimedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  claimedByName:{ type: String, default: '' },
  resolvedNote: { type: String, default: '' },
}, { timestamps: true });

lostFoundSchema.index({ status: 1, type: 1 });
lostFoundSchema.index({ itemName: 'text', description: 'text' });

module.exports = mongoose.model('LostFound', lostFoundSchema);
