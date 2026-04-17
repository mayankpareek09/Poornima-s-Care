const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { protect, requireRole } = require('../middleware/auth');

const ADMIN_ROLES = ['academic_admin','hostel_admin','campus_admin'];

// GET /api/complaints
router.get('/', protect, async (req, res) => {
  try {
    const { role } = req.user;
    let query = {};

    if (role === 'student') {
      query.studentId = req.user._id;
    } else if (ADMIN_ROLES.includes(role)) {
      // Each admin only sees complaints routed to them
      query.routedTo = role;
    } else if (role === 'laundry_admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    // council_admin can't see complaints either
    if (role === 'council_admin' || role === 'club_captain') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const complaints = await Complaint.find(query).sort({ createdAt: -1 });
    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/complaints — student submits
router.post('/', protect, requireRole('student'), async (req, res) => {
  try {
    const { title, category, description, priority, mediaUrl } = req.body;
    if (!title || !category || !description)
      return res.status(400).json({ success: false, message: 'Title, category, and description are required.' });
// Limit check: max 5 open complaints at a time
const openCount = await Complaint.countDocuments({ studentId: req.user._id, status: { $in: ['open', 'inprogress'] } });
if (openCount >= 5) {
  return res.status(400).json({ success: false, message: 'You already have 5 open complaints. Wait for them to be resolved before submitting more.' });
}
    const ROUTING = Complaint.CATEGORY_ROUTING || {
      'Hostel':'hostel_admin','Food':'hostel_admin','Water':'hostel_admin','Security':'hostel_admin',
      'Academic':'academic_admin','Timetable':'academic_admin','Faculty':'academic_admin',
      'Electricity':'campus_admin','Cleanliness':'campus_admin','Facilities':'campus_admin',
      'Transport':'campus_admin','Internet':'campus_admin','Other':'campus_admin',
    };
    const routedTo = ROUTING[category] || 'campus_admin';

    const complaint = await Complaint.create({
      studentId: req.user._id,
      studentName: req.user.name,
      studentUserId: req.user.userId,
      title, category, description,
      priority: priority || 'Medium',
      routedTo,
      mediaUrl: mediaUrl || '',
    });
    res.status(201).json({ success: true, message: `Complaint submitted — routed to ${routedTo.replace('_',' ')}.`, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/complaints/:id — any of the 3 admins updates their own complaints
router.patch('/:id', protect, async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role))
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    // Admin can only update complaints routed to them
    if (complaint.routedTo !== req.user.role)
      return res.status(403).json({ success: false, message: 'This complaint is not assigned to your department.' });

    const { status, adminRemarks } = req.body;
    const update = { status, adminRemarks };
    if (status === 'resolved') update.resolvedAt = new Date();

    const updated = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, message: 'Complaint updated!', complaint: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/complaints/routing-info — public info about categories
router.get('/routing-info', (req, res) => {
  res.json({
    success: true,
    routing: {
      academic_admin: ['Academic','Timetable','Faculty'],
      hostel_admin:   ['Hostel','Food','Water','Security'],
      campus_admin:   ['Electricity','Cleanliness','Facilities','Transport','Internet','Other'],
    }
  });
});

module.exports = router;
