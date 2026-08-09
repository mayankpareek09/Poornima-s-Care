const express = require('express');
const router = express.Router();
const MedicalAppointment = require('../models/MedicalAppointment');
const { protect, requireRole } = require('../middleware/auth');
const { sanitizeString } = require('../utils/apiHelpers');
const { createNotification } = require('../utils/notificationHelper');

// POST /api/medical/book — student books an appointment
router.post('/book', protect, requireRole('student'), async (req, res) => {
  try {
    const { symptoms, urgency, preferredDate } = req.body;
    if (!symptoms?.trim() || !preferredDate) return res.status(400).json({ success: false, message: 'Symptoms and preferred date are required.' });

    const pendingCount = await MedicalAppointment.countDocuments({ studentId: req.user._id, status: { $in: ['pending', 'confirmed'] } });
    if (pendingCount >= 2) return res.status(400).json({ success: false, message: 'You already have 2 active appointments. Please wait for them to be resolved.' });

    const appt = await MedicalAppointment.create({
      studentId: req.user._id, studentName: req.user.name, studentUserId: req.user.userId,
      symptoms: sanitizeString(symptoms), urgency: urgency === 'urgent' ? 'urgent' : 'routine', preferredDate,
    });
    res.status(201).json({ success: true, message: 'Appointment request sent. The Medical Center will confirm a slot soon.', appointment: appt });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// GET /api/medical/my — student's appointments
router.get('/my', protect, requireRole('student'), async (req, res) => {
  try {
    const appts = await MedicalAppointment.find({ studentId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, appointments: appts });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// PATCH /api/medical/:id/cancel — student cancels their own pending request
router.patch('/:id/cancel', protect, requireRole('student'), async (req, res) => {
  try {
    const appt = await MedicalAppointment.findOne({ _id: req.params.id, studentId: req.user._id });
    if (!appt) return res.status(404).json({ success: false, message: 'Not found.' });
    if (!['pending', 'confirmed'].includes(appt.status)) return res.status(400).json({ success: false, message: 'Cannot cancel this appointment.' });
    appt.status = 'cancelled';
    await appt.save();
    res.json({ success: true, message: 'Appointment cancelled.', appointment: appt });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// ---- Medical admin (nurse/desk) ----

router.get('/all', protect, requireRole('medical_admin'), async (req, res) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const appts = await MedicalAppointment.find(filter).sort({ urgency: -1, preferredDate: 1 });
    res.json({ success: true, appointments: appts });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

router.patch('/:id', protect, requireRole('medical_admin'), async (req, res) => {
  try {
    const { status, confirmedSlot, doctorNotes } = req.body;
    const appt = await MedicalAppointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ success: false, message: 'Not found.' });
    if (status && ['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) appt.status = status;
    if (confirmedSlot) appt.confirmedSlot = confirmedSlot;
    if (doctorNotes !== undefined) appt.doctorNotes = sanitizeString(doctorNotes);
    await appt.save();

    if (status === 'confirmed') createNotification(appt.studentId, 'Medical Center', `Your appointment is confirmed for ${new Date(appt.confirmedSlot || appt.preferredDate).toLocaleString('en-IN')}.`, 'system', appt._id, 'medium');
    if (status === 'completed') createNotification(appt.studentId, 'Medical Center', `Your medical visit is marked complete.${doctorNotes ? ' Note: ' + doctorNotes : ''}`, 'system', appt._id, 'low');

    res.json({ success: true, message: 'Updated.', appointment: appt });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
