const express = require('express');
const router = express.Router();
const Laundry = require('../models/Laundry');
const { protect, requireRole } = require('../middleware/auth');
const { createNotification } = require('../utils/notificationHelper');

const STATUS_STEPS = Laundry.STATUS_STEPS;
const STATUS_LABELS = {
  submitted: 'Submitted',
  collected: 'Collected from room',
  washing: 'Washing',
  drying: 'Drying',
  ironing: 'Ironing',
  ready: 'Ready for delivery',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
};

function genBagCode(userId) {
  return 'LDY-' + String(userId).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function getOrCreate(user) {
  let rec = await Laundry.findOne({ studentId: user._id });
  if (!rec) {
    rec = await Laundry.create({
      studentId: user._id,
      studentName: user.name,
      studentUserId: user.userId,
      hostel: user.hostel || '',
      room: user.room || '',
      bagCode: genBagCode(user.userId),
    });
  } else if (!rec.bagCode) {
    rec.bagCode = genBagCode(user.userId);
    await rec.save();
  }
  return rec;
}

// GET /api/laundry/my
router.get('/my', protect, requireRole('student'), async (req, res) => {
  try {
    const record = await getOrCreate(req.user);
    res.json({ success: true, record, statusSteps: STATUS_STEPS, statusLabels: STATUS_LABELS });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/laundry/submit
router.post('/submit', protect, requireRole('student'), async (req, res) => {
  try {
    const { clothesDesc } = req.body;
    const rec = await getOrCreate(req.user);
    if (rec.usedWashes >= rec.totalWashes)
      return res.status(400).json({ success: false, message: 'Annual wash quota of 30 exhausted.' });
    if (rec.currentStatus !== 'idle')
      return res.status(400).json({ success: false, message: 'You already have a bag submitted. Wait for it to be delivered before submitting another.' });
    const day = new Date().getDay();
    if (day === 5)
      return res.status(400).json({ success: false, message: 'Friday is a holiday — laundry submissions are closed today.' });

    const now = new Date();
    const estimatedCompletion = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const washNo = (rec.washHistory?.length || 0) + 1;
    const entry = {
      washNo, clothesDesc: clothesDesc || '', submittedAt: now, status: 'submitted',
      estimatedCompletion, stageTimestamps: { submitted: now },
    };
    rec.washHistory = rec.washHistory || [];
    rec.washHistory.push(entry);
    rec.currentStatus = 'submitted';
    rec.currentClothesDesc = clothesDesc || '';
    rec.currentSubmittedAt = now;
    rec.currentEstimatedCompletion = estimatedCompletion;
    rec.currentWashEntryId = rec.washHistory[rec.washHistory.length - 1]._id;
    await rec.save();
    res.json({ success: true, message: 'Bag submitted! Wash #' + washNo, record: rec });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// GET /api/laundry/all
router.get('/all', protect, requireRole('laundry_admin'), async (req, res) => {
  try {
    const records = await Laundry.find().sort({ updatedAt: -1 });
    res.json({ success: true, records, statusSteps: STATUS_STEPS, statusLabels: STATUS_LABELS });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// GET /api/laundry/scan/:bagCode — laundry admin scans a student's QR bag code
router.get('/scan/:bagCode', protect, requireRole('laundry_admin'), async (req, res) => {
  try {
    const rec = await Laundry.findOne({ bagCode: req.params.bagCode.toUpperCase() });
    if (!rec) return res.status(404).json({ success: false, message: 'No student found for this QR code.' });
    res.json({ success: true, record: rec, statusSteps: STATUS_STEPS, statusLabels: STATUS_LABELS });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// PATCH /api/laundry/:id — admin updates status (advances the pipeline)
router.patch('/:id', protect, requireRole('laundry_admin'), async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    if (!STATUS_STEPS.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });

    const rec = await Laundry.findById(req.params.id);
    if (!rec) return res.status(404).json({ success: false, message: 'Record not found.' });
    if (rec.currentStatus === 'idle')
      return res.status(400).json({ success: false, message: 'No active bag for this student.' });

    let entry = rec.currentWashEntryId ? rec.washHistory.id(rec.currentWashEntryId) : null;
    if (!entry && rec.washHistory?.length) entry = rec.washHistory[rec.washHistory.length - 1];

    const now = new Date();
    if (entry) {
      entry.status = status;
      if (adminNotes) entry.adminNotes = adminNotes;
      if (!entry.stageTimestamps) entry.stageTimestamps = new Map();
      entry.stageTimestamps.set(status, now);
    }

    rec.currentStatus = status;
    if (adminNotes) rec.adminNotes = adminNotes;

    if (status === 'delivered') {
      rec.usedWashes = (rec.usedWashes || 0) + 1;
      rec.currentStatus = 'idle';
      rec.currentClothesDesc = '';
      rec.currentSubmittedAt = null;
      rec.currentEstimatedCompletion = null;
      rec.currentWashEntryId = null;
    }

    await rec.save();

    createNotification(
      rec.studentId,
      'Laundry update',
      `Your laundry bag is now: ${STATUS_LABELS[status] || status}.${adminNotes ? ' Note: ' + adminNotes : ''}`,
      'laundry', rec._id, status === 'delivered' ? 'medium' : 'low'
    );

    res.json({ success: true, message: 'Updated to: ' + (STATUS_LABELS[status] || status), record: rec });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
