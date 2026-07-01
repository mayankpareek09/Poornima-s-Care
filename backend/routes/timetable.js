const express = require('express');
const router = express.Router();
const Timetable = require('../models/Timetable');
const { protect, requireRole } = require('../middleware/auth');

// GET /api/timetable — PUBLIC (no auth required)
router.get('/', async (req, res) => {
  try {
    const { course, semester } = req.query;
    const query = {};
    if (course) query.course = course;
    if (semester) query.semester = semester;
    const timetables = await Timetable.find(query).sort({ course: 1, semester: 1 });
    res.json({ success: true, timetables });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message });
  }
});

// POST /api/timetable — academic admin only
router.post('/', protect, requireRole('academic_admin'), async (req, res) => {
  try {
    const { course, semester, section, slots } = req.body;
    if (!course || !semester) return res.status(400).json({ success: false, message: 'Course and semester are required.' });
    const existing = await Timetable.findOne({ course, semester, section: section || 'A' });
    if (existing) return res.status(400).json({ success: false, message: 'Timetable for this course/semester already exists. Use edit instead.' });
    const timetable = await Timetable.create({ course, semester, section: section || 'A', slots: slots || [], updatedBy: req.user.name });
    res.status(201).json({ success: true, message: 'Timetable created!', timetable });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message });
  }
});

// PUT /api/timetable/:id
router.put('/:id', protect, requireRole('academic_admin'), async (req, res) => {
  try {
    const { slots, course, semester, section } = req.body;
    const timetable = await Timetable.findByIdAndUpdate(req.params.id,
      { slots, course, semester, section, updatedBy: req.user.name }, { new: true });
    if (!timetable) return res.status(404).json({ success: false, message: 'Timetable not found.' });
    res.json({ success: true, message: 'Timetable updated!', timetable });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message });
  }
});

// DELETE /api/timetable/:id
router.delete('/:id', protect, requireRole('academic_admin'), async (req, res) => {
  try {
    await Timetable.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Timetable deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message });
  }
});

module.exports = router;
