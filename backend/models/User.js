const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  email:          { type: String, trim: true, lowercase: true },
  userId:         { type: String, required: true, unique: true, trim: true },
  password:       { type: String, required: true },
  role: {
    type: String,
    enum: ['student','academic_admin','hostel_admin','campus_admin','laundry_admin',
           'council_admin','club_captain','vice_captain',
           'canteen_admin','mess_admin','store_admin','guard','faculty','super_admin','library_admin',
           'placement_admin','medical_admin'],
    required: true
  },
  // Student fields
  course:         { type: String },
  year:           { type: String },
  hostel:         { type: String },   // e.g. "Himalaya-1", "Gargi-2"
  room:           { type: String },   // e.g. "305"
  phone:          { type: String },
  // Profile (editable by user)
  dob:            { type: String },   // date of birth — user editable
  profilePhoto:   { type: String },   // base64 or URL
  // Laundry card
  laundryCardNo:  { type: String },   // e.g. "4661"
  // Admin / Council fields
  department:     { type: String },
  // Club captain / vice_captain
  clubId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
  clubName:       { type: String },
  // Council role title
  councilTitle:   { type: String },
  // Login security
  loginAttempts:  { type: Number, default: 0 },
  lockUntil:      { type: Date },
  // OTP fields
  otp:            { type: String },
  otpExpires:     { type: Date },
  isVerified:     { type: Boolean, default: false },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(pwd) {
  return bcrypt.compare(pwd, this.password);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpires;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  return obj;
};

// Check if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

module.exports = mongoose.model('User', userSchema);
