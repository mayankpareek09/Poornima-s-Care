const express = require('express');
const router  = express.Router();
const Visitor = require('../models/Visitor');
const { escapeRegex } = require('../utils/sanitize');
const { protect, requireRole } = require('../middleware/auth');

const GUARD_ROLES = ['guard','campus_admin','super_admin'];

// Reuses the same Fast2SMS pattern as auth.js — falls back to console log if no API key set
async function sendVisitorOtp(mobile, otp, visitorName) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const cleanPhone = (mobile || '').replace(/\D/g, '').slice(-10);

  if (!apiKey || cleanPhone.length !== 10) {
    console.log(`\n🚪 Visitor OTP for ${visitorName} (${mobile}): ════════ ${otp} ════════\n`);
    return { delivered: false };
  }
  try {
    const url = `https://www.fast2sms.com/dev/bulkV2?authorization=${apiKey}&variables_values=${otp}&route=otp&numbers=${cleanPhone}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.return === true) return { delivered: true };
    console.log(`\n🚪 Fallback — Visitor OTP for ${visitorName} (${mobile}): ════════ ${otp} ════════\n`);
    return { delivered: false };
  } catch (err) {
    console.log(`\n🚪 Fallback — Visitor OTP for ${visitorName} (${mobile}): ════════ ${otp} ════════\n`);
    return { delivered: false };
  }
}

// POST /api/visitors — guard registers a new visitor, OTP sent
router.post('/', protect, requireRole(GUARD_ROLES), async (req, res) => {
  try {
    const { visitorName, mobile, reason, whomToMeet, vehicleNo } = req.body;
    if (!visitorName || !mobile || !reason || !whomToMeet)
      return res.status(400).json({ success:false, message:'Visitor name, mobile, reason, and whom to meet are required.' });

    const otp = Visitor.generateOtp();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const visitor = await Visitor.create({
      visitorName, mobile, reason, whomToMeet, vehicleNo: vehicleNo || '',
      otp, otpExpires,
      loggedBy: req.user.name || req.user.userId,
    });

    const sms = await sendVisitorOtp(mobile, otp, visitorName);
    res.status(201).json({
      success: true,
      message: sms.delivered ? 'OTP sent to visitor\'s phone.' : 'OTP generated (check server logs — SMS not configured).',
      visitor: { _id: visitor._id, visitorName: visitor.visitorName, mobile: visitor.mobile, status: visitor.status }
    });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// PATCH /api/visitors/:id/verify — guard enters the OTP the visitor read out
router.patch('/:id/verify', protect, requireRole(GUARD_ROLES), async (req, res) => {
  try {
    const { otp } = req.body;
    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) return res.status(404).json({ success:false, message:'Visitor record not found.' });
    if (visitor.status !== 'pending_otp')
      return res.status(400).json({ success:false, message:'This visitor is already verified or checked out.' });
    if (new Date() > visitor.otpExpires)
      return res.status(400).json({ success:false, message:'OTP expired. Please log the visitor again.' });
    if (visitor.otp !== String(otp).trim())
      return res.status(400).json({ success:false, message:'Incorrect OTP. Please try again.' });

    visitor.status = 'verified';
    visitor.checkInTime = new Date();
    await visitor.save();
    res.json({ success:true, message:`✅ Verified! ${visitor.visitorName} may enter.`, visitor });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// PATCH /api/visitors/:id/checkout — mark visitor as exited
router.patch('/:id/checkout', protect, requireRole(GUARD_ROLES), async (req, res) => {
  try {
    const visitor = await Visitor.findById(req.params.id);
    if (!visitor) return res.status(404).json({ success:false, message:'Visitor record not found.' });
    if (visitor.status !== 'verified')
      return res.status(400).json({ success:false, message:'Visitor must be verified before checkout.' });

    visitor.status = 'checked_out';
    visitor.checkOutTime = new Date();
    await visitor.save();
    res.json({ success:true, message:`${visitor.visitorName} checked out.`, visitor });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// GET /api/visitors?date=YYYY-MM-DD&q=search — guard's daily log
router.get('/', protect, requireRole(GUARD_ROLES), async (req, res) => {
  try {
    const { date, q } = req.query;
    const filter = {};
    if (date) {
      const d = new Date(date); const next = new Date(d); next.setDate(next.getDate()+1);
      filter.createdAt = { $gte: d, $lt: next };
    } else {
      const today = new Date(); today.setHours(0,0,0,0);
      filter.createdAt = { $gte: today };
    }
    if (q) {
      const safeQ = escapeRegex(q);
      filter.$or = [
        { visitorName: { $regex: safeQ, $options:'i' } },
        { mobile: { $regex: safeQ, $options:'i' } },
      ];
    }
    const visitors = await Visitor.find(filter).sort({ createdAt:-1 }).limit(200);
    res.json({ success:true, visitors });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// GET /api/visitors/export?date=YYYY-MM-DD — CSV export
router.get('/export', protect, requireRole(GUARD_ROLES), async (req, res) => {
  try {
    const { date } = req.query;
    const filter = {};
    if (date) {
      const d = new Date(date); const next = new Date(d); next.setDate(next.getDate()+1);
      filter.createdAt = { $gte: d, $lt: next };
    }
    const visitors = await Visitor.find(filter).sort({ createdAt:-1 });

    let csv = 'Visitor Name,Mobile,Reason,Whom to Meet,Vehicle No,Status,Check-In,Check-Out,Logged By\n';
    visitors.forEach(v => {
      csv += `"${v.visitorName}","${v.mobile}","${v.reason}","${v.whomToMeet}","${v.vehicleNo||''}","${v.status}","${v.checkInTime?v.checkInTime.toLocaleString('en-IN'):''}","${v.checkOutTime?v.checkOutTime.toLocaleString('en-IN'):''}","${v.loggedBy}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="visitors-${date||'today'}.csv"`);
    res.send(csv);
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

module.exports = router;
