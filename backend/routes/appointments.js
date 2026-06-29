const express        = require('express');
const router         = express.Router();
const FacultyProfile = require('../models/FacultyProfile');
const Appointment    = require('../models/Appointment');
const User           = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');

// ────────────────────────────────────────────────
//  FACULTY PROFILES & AVAILABILITY
// ────────────────────────────────────────────────

// GET /api/appointments/faculty-list — students browse faculty
router.get('/faculty-list', protect, async (req, res) => {
  try {
    const profiles = await FacultyProfile.find({ isAcceptingAppointments: true })
      .populate('userId', 'name userId');
    res.json({ success:true, faculty: profiles });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// POST /api/appointments/faculty/profile — faculty creates/updates own profile
router.post('/faculty/profile', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { department, designation, availableSlots, isAcceptingAppointments } = req.body;
    const profile = await FacultyProfile.findOneAndUpdate(
      { userId: req.user._id },
      {
        userId: req.user._id,
        facultyName: req.user.name,
        department: department || 'General',
        designation: designation || 'Faculty',
        availableSlots: Array.isArray(availableSlots) ? availableSlots : [],
        isAcceptingAppointments: isAcceptingAppointments !== false,
      },
      { upsert: true, new: true }
    );
    res.json({ success:true, message:'Profile updated!', profile });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// GET /api/appointments/faculty/profile/my — faculty views own profile
router.get('/faculty/profile/my', protect, requireRole('faculty'), async (req, res) => {
  try {
    const profile = await FacultyProfile.findOne({ userId: req.user._id });
    res.json({ success:true, profile: profile || null });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// GET /api/appointments/faculty/:id/availability?date=YYYY-MM-DD — slots + which are booked
router.get('/faculty/:id/availability', protect, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success:false, message:'date query param required' });

    const profile = await FacultyProfile.findOne({ userId: req.params.id });
    if (!profile) return res.status(404).json({ success:false, message:'Faculty profile not found' });

    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const requestedDay = dayNames[new Date(date+'T00:00:00').getDay()];
    const daySlots = profile.availableSlots.filter(s => s.day === requestedDay);

    const bookedAppointments = await Appointment.find({
      facultyId: req.params.id, date, status: { $in: ['pending','accepted'] }
    });
    const bookedSlots = bookedAppointments.map(a => a.timeSlot);

    const slots = daySlots.map(s => ({
      ...s.toObject ? s.toObject() : s,
      label: `${s.startTime} - ${s.endTime}`,
      isBooked: bookedSlots.includes(`${s.startTime} - ${s.endTime}`),
    }));

    res.json({ success:true, day: requestedDay, slots });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// ────────────────────────────────────────────────
//  APPOINTMENTS
// ────────────────────────────────────────────────

// POST /api/appointments — student books an appointment
router.post('/', protect, requireRole('student'), async (req, res) => {
  try {
    const { facultyId, date, timeSlot, reason } = req.body;
    if (!facultyId || !date || !timeSlot || !reason)
      return res.status(400).json({ success:false, message:'facultyId, date, timeSlot, and reason are required.' });

    const faculty = await User.findById(facultyId);
    if (!faculty || faculty.role !== 'faculty')
      return res.status(400).json({ success:false, message:'Faculty not found.' });

    // Prevent double booking the same slot
    const clash = await Appointment.findOne({ facultyId, date, timeSlot, status: { $in: ['pending','accepted'] } });
    if (clash) return res.status(409).json({ success:false, message:'This slot was just booked by someone else. Pick another.' });

    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const day = dayNames[new Date(date+'T00:00:00').getDay()];

    const appointment = await Appointment.create({
      studentId: req.user._id, studentName: req.user.name, studentUserId: req.user.userId,
      facultyId: faculty._id, facultyName: faculty.name,
      date, day, timeSlot, reason,
    });
    res.status(201).json({ success:true, message:'Appointment requested! Waiting for faculty approval.', appointment });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// GET /api/appointments/my — student's own appointments
router.get('/my', protect, requireRole('student'), async (req, res) => {
  try {
    const appointments = await Appointment.find({ studentId: req.user._id }).sort({ createdAt:-1 }).limit(50);
    res.json({ success:true, appointments });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// PATCH /api/appointments/:id/cancel — student cancels before response
router.patch('/:id/cancel', protect, requireRole('student'), async (req, res) => {
  try {
    const appt = await Appointment.findOne({ _id: req.params.id, studentId: req.user._id });
    if (!appt) return res.status(404).json({ success:false, message:'Appointment not found.' });
    if (appt.status !== 'pending')
      return res.status(400).json({ success:false, message:'Only pending appointments can be cancelled.' });
    appt.status = 'cancelled';
    await appt.save();
    res.json({ success:true, message:'Appointment cancelled.', appointment: appt });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// GET /api/appointments/requests — faculty sees requests for them
router.get('/requests', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { facultyId: req.user._id };
    if (status) filter.status = status;
    const appointments = await Appointment.find(filter).sort({ status:1, date:1 }).limit(100);
    res.json({ success:true, appointments });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// PATCH /api/appointments/:id — faculty accepts/rejects
router.patch('/:id', protect, requireRole('faculty'), async (req, res) => {
  try {
    const { status, facultyResponse } = req.body;
    if (!['accepted','rejected'].includes(status))
      return res.status(400).json({ success:false, message:'Status must be accepted or rejected.' });

    const appt = await Appointment.findOne({ _id: req.params.id, facultyId: req.user._id });
    if (!appt) return res.status(404).json({ success:false, message:'Appointment not found.' });
    if (appt.status !== 'pending')
      return res.status(400).json({ success:false, message:'This appointment was already responded to.' });

    appt.status = status;
    appt.facultyResponse = facultyResponse || '';
    appt.respondedAt = new Date();
    await appt.save();
    res.json({ success:true, message:`Appointment ${status}.`, appointment: appt });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

module.exports = router;
