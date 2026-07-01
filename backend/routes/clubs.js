const express = require('express');
const router = express.Router();
const Club = require('../models/Club');
const { protect, requireRole } = require('../middleware/auth');

const CAPTAIN_ROLES = ['club_captain','vice_captain'];

// GET /api/clubs — public
router.get('/', async (req, res) => {
  try {
    const clubs = await Club.find({ isActive: true }).sort({ name: 1 });
    res.json({ success: true, clubs });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/clubs — council_admin only
router.post('/', protect, requireRole('academic_admin','council_admin'), async (req, res) => {
  try {
    const club = await Club.create(req.body);
    res.status(201).json({ success: true, message: 'Club created!', club });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// PUT /api/clubs/:id — council_admin (all), captain/vice_captain (own club)
router.put('/:id', protect, requireRole('academic_admin','council_admin','club_captain','vice_captain'), async (req, res) => {
  try {
    if (CAPTAIN_ROLES.includes(req.user.role)) {
      const clubIdStr = req.user.clubId?.toString();
      if (!clubIdStr || clubIdStr !== req.params.id)
        return res.status(403).json({ success: false, message: 'You can only edit your own club.' });
    }
    const club = await Club.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!club) return res.status(404).json({ success: false, message: 'Club not found.' });
    res.json({ success: true, message: 'Club updated!', club });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// DELETE /api/clubs/:id — council_admin only
router.delete('/:id', protect, requireRole('academic_admin','council_admin'), async (req, res) => {
  try {
    await Club.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Club deactivated.' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
