const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const { protect, requireRole } = require('../middleware/auth');
const { sanitizeBody } = require('../utils/apiHelpers');

// GET /api/events — public
router.get('/', async (req, res) => {
  try {
    const { type, ongoing } = req.query;
    const query = {};
    if (type) query.type = type;
    if (ongoing === 'true') query.isOngoing = true;
    const events = await Event.find(query).sort({ date: 1 });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message });
  }
});

// POST /api/events — academic admin, council admin, club captain
router.post('/', protect, requireRole('academic_admin','council_admin','club_captain','vice_captain'), async (req, res) => {
  try {
    const { title, description, date, time, venue, type, clubName, isOngoing } = req.body;
    if (!title || !date) return res.status(400).json({ success: false, message: 'Title and date are required.' });
    // club_captain can only add events for their own club
    let finalClubName = clubName;
    if (['club_captain','vice_captain'].includes(req.user.role)) finalClubName = req.user.clubName;
    const event = await Event.create({ title, description, date, time, venue, type: type||'club', clubName: finalClubName, isOngoing: isOngoing||false, createdBy: req.user.name, createdByRole: req.user.role, createdById: req.user._id });
    res.status(201).json({ success: true, message: 'Event created!', event });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message });
  }
});

// PUT /api/events/:id — academic admin, council admin, club captain (own events)
router.put('/:id', protect, requireRole('academic_admin','council_admin','club_captain','vice_captain'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    if (['club_captain','vice_captain'].includes(req.user.role) && event.createdById?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit events you created.' });
    }
    const updated = await Event.findByIdAndUpdate(req.params.id, sanitizeBody(req.body), { new: true });
    res.json({ success: true, message: 'Event updated!', event: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message });
  }
});

// DELETE /api/events/:id
router.delete('/:id', protect, requireRole('academic_admin','council_admin','club_captain','vice_captain'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });
    if (['club_captain','vice_captain'].includes(req.user.role) && event.createdById?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete events you created.' });
    }
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Event deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message });
  }
});
// POST /api/events/:id/register — student registers for event
router.post('/:id/register', protect, requireRole('student'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    if (!event.registeredStudents) event.registeredStudents = [];
    const alreadyReg = event.registeredStudents.includes(req.user._id);
    if (alreadyReg) {
      event.registeredStudents.pull(req.user._id);
      await event.save();
      return res.json({ success: true, registered: false, count: event.registeredStudents.length });
    } else {
      event.registeredStudents.push(req.user._id);
      await event.save();
      return res.json({ success: true, registered: true, count: event.registeredStudents.length });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message });
  }
});
module.exports = router;
