const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title:      { type: String, required: true },
  message:    { type: String, required: true },
  type:       { type: String, enum: ['complaint','laundry','event','sos','escalation','reminder','system'], default: 'system' },
  refId:      { type: mongoose.Schema.Types.ObjectId, default: null },
  isRead:     { type: Boolean, default: false },
  priority:   { type: String, enum: ['low','medium','high','critical'], default: 'medium' },
}, { timestamps: true });

// Speeds up the notification bell's unread-count query, run on nearly every page load
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);