const mongoose = require('mongoose');

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
}

const visitorSchema = new mongoose.Schema({
  visitorName: { type: String, required: true, trim: true },
  mobile:      { type: String, required: true, trim: true },
  reason:      { type: String, required: true, trim: true },
  whomToMeet:  { type: String, required: true, trim: true },
  vehicleNo:   { type: String, default: '', trim: true },

  otp:         { type: String, required: true },
  otpExpires:  { type: Date, required: true },

  status:      { type: String, enum: ['pending_otp','verified','checked_out'], default: 'pending_otp' },
  checkInTime: { type: Date },
  checkOutTime:{ type: Date },

  loggedBy:    { type: String, required: true }, // guard's name
}, { timestamps: true });

visitorSchema.statics.generateOtp = generateOtp;

module.exports = mongoose.model('Visitor', visitorSchema);
