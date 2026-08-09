const express = require('express');
const router = express.Router();
const CampusLocation = require('../models/CampusLocation');
const { protect, requireRole } = require('../middleware/auth');
const { sanitizeString } = require('../utils/apiHelpers');

// GET /api/campus-locations — browse directory (any logged-in user)
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.query.category ? { category: req.query.category } : {};
    const locations = await CampusLocation.find(filter).sort({ category: 1, name: 1 });
    res.json({ success: true, locations });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/campus-locations — campus_admin manages the directory
router.post('/', protect, requireRole('campus_admin'), async (req, res) => {
  try {
    const { name, category, block, floor, description, hours, icon } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Location name is required.' });
    const loc = await CampusLocation.create({
      name: sanitizeString(name), category: category || 'Other', block: sanitizeString(block || ''),
      floor: sanitizeString(floor || ''), description: sanitizeString(description || ''),
      hours: sanitizeString(hours || ''), icon: icon || '📍', addedBy: req.user._id,
    });
    res.status(201).json({ success: true, message: 'Location added.', location: loc });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

router.patch('/:id', protect, requireRole('campus_admin'), async (req, res) => {
  try {
    const loc = await CampusLocation.findById(req.params.id);
    if (!loc) return res.status(404).json({ success: false, message: 'Location not found.' });
    const fields = ['name', 'category', 'block', 'floor', 'description', 'hours', 'icon'];
    fields.forEach(f => { if (req.body[f] !== undefined) loc[f] = typeof req.body[f] === 'string' ? sanitizeString(req.body[f]) : req.body[f]; });
    await loc.save();
    res.json({ success: true, message: 'Location updated.', location: loc });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

router.delete('/:id', protect, requireRole('campus_admin'), async (req, res) => {
  try {
    await CampusLocation.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Location removed.' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
