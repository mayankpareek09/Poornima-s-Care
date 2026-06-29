const express = require('express');
const router = express.Router();
const SOS = require('../models/SOS');
const { protect, requireRole } = require('../middleware/auth');

const ADMIN_ROLES = ['academic_admin', 'hostel_admin', 'campus_admin', 'super_admin'];

// POST /api/sos — student triggers SOS
router.post('/', protect, requireRole('student'), async (req, res) => {
  try {
    const { message, location } = req.body;
    const u = req.user;

    const recentSOS = await SOS.findOne({
      studentId: u._id,
      status: 'active',
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
    });
    if (recentSOS) {
      return res.status(429).json({
        success: false,
        message: 'You already have an active SOS alert. Please wait before sending another.'
      });
    }

    const sos = await SOS.create({
      studentId:     u._id,
      studentName:   u.name,
      studentUserId: u.userId,
      phone:         u.phone   || 'Not provided',
      hostel:        u.hostel  || 'Not provided',
      room:          u.room    || 'Not provided',
      campus:        'Poornima University, Jaipur',
      message:       message   || 'Emergency! Immediate assistance needed.',
      location:      location  || '',
    });

    res.status(201).json({
      success: true,
      message: '🚨 SOS Alert sent! Admins have been notified. Help is on the way.',
      sos
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sos — admins fetch all SOS alerts, students fetch their own
router.get('/', protect, async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) {
      if (req.user.role === 'student') {
        const alerts = await SOS.find({ studentId: req.user._id }).sort({ createdAt: -1 }).limit(10);
        return res.json({ success: true, alerts });
      }
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    const alerts = await SOS.find({}).sort({ status: 1, createdAt: -1 }).limit(100);
    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sos/active-count — quick badge count for admins
router.get('/active-count', protect, async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role)) return res.json({ success: true, count: 0 });
    const count = await SOS.countDocuments({ status: 'active' });
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/sos/:id — admin acknowledges or resolves SOS
router.patch('/:id', protect, async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role))
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const { status } = req.body;
    if (!['acknowledged', 'resolved'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status. Use acknowledged or resolved.' });

    const update = { status, acknowledgedBy: req.user.name || req.user.userId };
    if (status === 'acknowledged') update.acknowledgedAt = new Date();
    if (status === 'resolved')    update.resolvedAt = new Date();

    const sos = await SOS.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!sos) return res.status(404).json({ success: false, message: 'SOS alert not found.' });

    res.json({ success: true, message: `SOS marked as ${status}.`, sos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
