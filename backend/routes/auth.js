const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const { protect } = require('../middleware/auth');
const { sanitizeString } = require('../utils/apiHelpers');

const MAX_ATTEMPTS = 5;
const LOCK_TIME    = 15 * 60 * 1000;

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '30d'
});

function normalizeRegNo(raw) {
  const cleaned = raw.trim().toUpperCase().replace(/\s/g,'');
  if (/^\d{4}[A-Z]{2}[A-Z]{3,6}[A-Z]{2}X?\d{4,6}$/.test(cleaned)) return cleaned;
  const shortMatch = cleaned.match(/^(\d{4})[\/\-]?(\d{4,6})$/);
  if (shortMatch) return `${shortMatch[1]}PUFCEBCSX${shortMatch[2]}`;
  return cleaned;
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isPoornimaEmail(email) {
  if (!email) return false;
  return /^[a-zA-Z0-9._%+\-]+@poornima\.edu\.in$/.test(email.toLowerCase());
}

// Send OTP via SMS (Fast2SMS) — falls back to console log if FAST2SMS_API_KEY is not set,
// so registration never breaks even before you've configured an SMS provider.
async function sendSmsOtp(phone, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);

  if (!apiKey || !cleanPhone || cleanPhone.length !== 10) {
    console.log(`\n📱 OTP for ${phone}: ════════ ${otp} ════════\n`);
    return { delivered: false, reason: !apiKey ? 'No FAST2SMS_API_KEY configured' : 'Invalid phone number' };
  }

  try {
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&variables_values=${otp}&route=otp&numbers=${cleanPhone}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.return === true) {
      console.log(`✅ OTP SMS sent to ${cleanPhone}`);
      return { delivered: true };
    }
    console.log(`⚠️ Fast2SMS rejected request: ${JSON.stringify(data)}`);
    console.log(`\n📱 Fallback — OTP for ${phone}: ════════ ${otp} ════════\n`);
    return { delivered: false, reason: 'Fast2SMS API error' };
  } catch (err) {
    console.log(`⚠️ SMS send failed: ${err.message}`);
    console.log(`\n📱 Fallback — OTP for ${phone}: ════════ ${otp} ════════\n`);
    return { delivered: false, reason: err.message };
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { userId, password, role } = req.body;
    if (!userId || !password)
      return res.status(400).json({ success: false, message: 'User ID and password are required.' });

    const normalizedId = normalizeRegNo(userId);
    const user = await User.findOne({ userId: normalizedId });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials.' });

    if (user.isLocked) {
      const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(429).json({ success: false, message: `Account locked. Try again in ${remaining} minute(s).` });
    }

    if (user.role === 'student' && !user.isVerified)
      return res.status(401).json({ success: false, message: 'Account not verified. Please verify OTP.', requiresOtp: true });

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= MAX_ATTEMPTS) { user.lockUntil = new Date(Date.now() + LOCK_TIME); user.loginAttempts = 0; }
      await user.save();
      const remaining = MAX_ATTEMPTS - (user.loginAttempts || 0);
      return res.status(401).json({ success: false, message: `Invalid credentials. ${remaining > 0 ? remaining + ' attempt(s) remaining.' : 'Account locked for 15 minutes.'}` });
    }

    const roleForLogin = role === 'club_captain' ? ['club_captain','vice_captain'] : [role];
    if (!roleForLogin.includes(user.role))
      return res.status(403).json({ success: false, message: `This account is not registered as ${role.replace('_',' ')}.` });

    user.loginAttempts = 0; user.lockUntil = undefined;
    await user.save();
    res.json({ success: true, token: signToken(user._id), user: user.toJSON() });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, userId, password, course, year, hostel, room, phone, email } = req.body;
    if (!name || !userId || !password)
      return res.status(400).json({ success: false, message: 'Name, University ID and password are required.' });
    if (email && !isPoornimaEmail(email))
      return res.status(400).json({ success: false, message: 'Only @poornima.edu.in email addresses are allowed.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const normalizedId = normalizeRegNo(userId);
    const exists = await User.findOne({ userId: normalizedId });
    if (exists) {
      if (!exists.isVerified) {
        const otp = generateOTP();
        exists.otp = otp; exists.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await exists.save();
        await sendSmsOtp(exists.phone || '', otp);
        console.log(`\n📱 OTP for ${normalizedId}: ════════ ${otp} ════════\n`);
        return res.json({ success: true, requiresOtp: true, userId: normalizedId, message: 'OTP sent again.' });
      }
      return res.status(400).json({ success: false, message: 'University ID already registered.' });
    }

    const otp = generateOTP();
    await User.create({
      name: name.trim(), userId: normalizedId, password, email: email || '',
      role: 'student', course: course || '', year: year || '1st Year',
      hostel: hostel || '', room: room || '', phone: phone || '',
      otp, otpExpires: new Date(Date.now() + 10 * 60 * 1000), isVerified: false,
    });
    await sendSmsOtp(phone || '', otp);
    console.log(`\n📱 OTP for ${normalizedId}: ════════ ${otp} ════════\n`);
    res.status(201).json({ success: true, requiresOtp: true, userId: normalizedId, message: 'Registration started. OTP printed in server terminal.' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body;
    const normalizedId = normalizeRegNo(userId);
    const user = await User.findOne({ userId: normalizedId });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.isVerified) return res.json({ success: true, message: 'Already verified.' });
    if (!user.otp || user.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP.' });
    if (user.otpExpires < new Date()) return res.status(400).json({ success: false, message: 'OTP expired. Please register again.' });
    user.isVerified = true; user.otp = undefined; user.otpExpires = undefined;
    await user.save();
    res.json({ success: true, message: 'Account verified!', token: signToken(user._id), user: user.toJSON() });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  res.json({ success: true, user: req.user.toJSON() });
});

// PATCH /api/auth/profile
router.patch('/profile', protect, async (req, res) => {
  try {
    const { dob, phone, profilePhoto } = req.body;
    const update = {};
    if (dob !== undefined) update.dob = dob;
    if (phone !== undefined) update.phone = phone;
    if (profilePhoto !== undefined) update.profilePhoto = profilePhoto;
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    res.json({ success: true, message: 'Profile updated!', user: user.toJSON() });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/auth/register-admin
router.post('/register-admin', async (req, res) => {
  try {
    const { name, userId, password, role, department, clubName, clubId, adminKey } = req.body;
    const headerKey = req.headers['x-admin-key'];
    const providedKey = adminKey || headerKey;
    const ADMIN_SECRET = process.env.ADMIN_SECRET || 'PC_ADMIN_2026';
    if (providedKey !== ADMIN_SECRET)
      return res.status(403).json({ success: false, message: 'Invalid admin secret key.' });

    const ALLOWED = ['academic_admin','hostel_admin','campus_admin','laundry_admin','council_admin','club_captain','vice_captain','canteen_admin','mess_admin','store_admin','guard','faculty'];
    if (!ALLOWED.includes(role)) return res.status(400).json({ success: false, message: 'Invalid admin role.' });
    if (!name || !userId || !password) return res.status(400).json({ success: false, message: 'All fields are required.' });
    if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const exists = await User.findOne({ userId });
    if (exists) return res.status(400).json({ success: false, message: 'User ID already taken.' });

    const user = await User.create({
      name, userId, password, role, department: department || '',
      clubName: clubName || '', clubId: clubId || undefined, isVerified: true,
    });
    res.status(201).json({ success: true, message: 'Admin account created!', user: user.toJSON() });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;