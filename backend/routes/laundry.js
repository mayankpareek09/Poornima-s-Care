const express = require('express');
const router = express.Router();
const Laundry = require('../models/Laundry');
const { protect, requireRole } = require('../middleware/auth');

async function getOrCreate(user) {
  let rec = await Laundry.findOne({ studentId: user._id });
  if (!rec) {
    rec = await Laundry.create({
      studentId: user._id,
      studentName: user.name,
      studentUserId: user.userId,
      hostel: user.hostel || '',
      room: user.room || '',
    });
  }
  return rec;
}

// GET /api/laundry/my
router.get('/my', protect, requireRole('student'), async (req, res) => {
  try {
    const record = await getOrCreate(req.user);
    res.json({ success: true, record });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/laundry/submit
router.post('/submit', protect, requireRole('student'), async (req, res) => {
  try {
    const { clothesDesc } = req.body;
    const rec = await getOrCreate(req.user);
    if (rec.usedWashes >= rec.totalWashes)
      return res.status(400).json({ success: false, message: 'Annual wash quota of 30 exhausted.' });
    if (rec.currentStatus !== 'idle')
      return res.status(400).json({ success: false, message: 'You already have a bag submitted. Collect it before submitting another.' });
    const day = new Date().getDay();
    if (day === 5)
      return res.status(400).json({ success: false, message: 'Friday is a holiday — laundry submissions are closed today.' });
    const washNo = (rec.washHistory?.length || 0) + 1;
    const entry = { washNo, clothesDesc: clothesDesc || '', submittedAt: new Date(), status: 'submitted' };
    rec.washHistory = rec.washHistory || [];
    rec.washHistory.push(entry);
    rec.currentStatus = 'submitted';
    rec.currentClothesDesc = clothesDesc || '';
    rec.currentSubmittedAt = new Date();
    rec.currentWashEntryId = rec.washHistory[rec.washHistory.length - 1]._id;
    await rec.save();
    res.json({ success: true, message: 'Bag submitted! Wash #' + washNo, record: rec });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/laundry/all
router.get('/all', protect, requireRole('laundry_admin'), async (req, res) => {
  try {
    const records = await Laundry.find().sort({ updatedAt: -1 });
    res.json({ success: true, records });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PATCH /api/laundry/:id — admin updates status
router.patch('/:id', protect, requireRole('laundry_admin'), async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const rec = await Laundry.findById(req.params.id);
    if (!rec) return res.status(404).json({ success: false, message: 'Record not found.' });

    // Find the active wash entry — use currentWashEntryId OR fall back to last history entry
    let entry = null;
    if (rec.currentWashEntryId) {
      entry = rec.washHistory.id(rec.currentWashEntryId);
    }
    // If no entry found by ID, use the last history entry that is not collected
    if (!entry && rec.washHistory && rec.washHistory.length > 0) {
      const notCollected = rec.washHistory.filter(h => h.status !== 'collected');
      if (notCollected.length > 0) entry = notCollected[notCollected.length - 1];
    }

    if (entry) {
      entry.status = status;
      if (adminNotes) entry.adminNotes = adminNotes;
      if (status === 'collected') entry.collectedAt = new Date();
    }

    rec.currentStatus = status === 'collected' ? 'idle' : status;
    if (adminNotes) rec.adminNotes = adminNotes;

    if (status === 'collected') {
      rec.usedWashes = (rec.usedWashes || 0) + 1;
      rec.currentClothesDesc = '';
      rec.currentSubmittedAt = null;
      rec.currentWashEntryId = null;
    }

    await rec.save();
    res.json({ success: true, message: 'Updated!', record: rec });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
