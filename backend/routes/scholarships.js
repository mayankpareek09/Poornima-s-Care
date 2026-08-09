const express = require('express');
const router = express.Router();
const Scholarship = require('../models/Scholarship');
const { protect, requireRole } = require('../middleware/auth');
const { sanitizeString } = require('../utils/apiHelpers');

// GET /api/scholarships — browse (any logged-in user)
router.get('/', protect, async (req, res) => {
  try {
    const filter = { status: 'open', deadline: { $gte: new Date() } };
    const scholarships = await Scholarship.find(filter).sort({ deadline: 1 }).limit(200);
    res.json({ success: true, scholarships });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

router.post('/', protect, requireRole('placement_admin'), async (req, res) => {
  try {
    const { name, provider, amount, eligibility, deadline, applyInfo } = req.body;
    if (!name?.trim() || !deadline) return res.status(400).json({ success: false, message: 'Name and deadline are required.' });
    const sch = await Scholarship.create({
      name: sanitizeString(name), provider: sanitizeString(provider || ''), amount: sanitizeString(amount || ''),
      eligibility: sanitizeString(eligibility || ''), deadline, applyInfo: sanitizeString(applyInfo || ''), postedBy: req.user._id,
    });
    res.status(201).json({ success: true, message: 'Scholarship posted.', scholarship: sch });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

router.patch('/:id/close', protect, requireRole('placement_admin'), async (req, res) => {
  try {
    const sch = await Scholarship.findByIdAndUpdate(req.params.id, { status: 'closed' }, { new: true });
    if (!sch) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, message: 'Closed.', scholarship: sch });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

router.delete('/:id', protect, requireRole('placement_admin'), async (req, res) => {
  try {
    await Scholarship.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
