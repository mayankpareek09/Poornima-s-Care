const express = require('express');
const router = express.Router();
const LostFound = require('../models/LostFound');
const { protect, requireRole } = require('../middleware/auth');
const { sanitizeString, validateImageDataUri } = require('../utils/apiHelpers');
const { createNotification } = require('../utils/notificationHelper');
const cloudinaryUtil = require('../utils/cloudinary');

// GET /api/lostfound — browse all open items (any logged-in user), newest first.
// Optional query filters: type=lost|found, category=..., q=search text
router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.type && ['lost', 'found'].includes(req.query.type)) filter.type = req.query.type;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status && ['open', 'claimed', 'closed'].includes(req.query.status)) filter.status = req.query.status;
    else filter.status = { $ne: 'closed' }; // default: hide closed items unless explicitly requested
    if (req.query.q) filter.$text = { $search: req.query.q };

    const items = await LostFound.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, items });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// GET /api/lostfound/mine — items the logged-in user reported
router.get('/mine', protect, async (req, res) => {
  try {
    const items = await LostFound.find({ reporterId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/lostfound — report a lost or found item
router.post('/', protect, async (req, res) => {
  try {
    const { type, itemName, description, category, location, photo } = req.body;
    if (!['lost', 'found'].includes(type))
      return res.status(400).json({ success: false, message: 'Type must be "lost" or "found".' });
    if (!itemName || !itemName.trim())
      return res.status(400).json({ success: false, message: 'Item name is required.' });

    const imgCheck = validateImageDataUri(photo);
    if (!imgCheck.ok) return res.status(400).json({ success: false, message: imgCheck.message });
    let photoValue = photo || '';
    if (photoValue.startsWith('data:image') && cloudinaryUtil.isConfigured) {
      try { photoValue = await cloudinaryUtil.uploadImage(photoValue, req.user._id + '-' + Date.now(), 'poornima-s-care/lostfound'); }
      catch (uploadErr) { console.error('Cloudinary upload failed for lost&found photo:', uploadErr.message); }
    }

    const item = await LostFound.create({
      reporterId: req.user._id,
      reporterName: req.user.name,
      reporterUserId: req.user.userId,
      type,
      itemName: sanitizeString(itemName),
      description: sanitizeString(description || ''),
      category: category || 'Other',
      location: sanitizeString(location || ''),
      photo: photoValue,
    });
    res.status(201).json({ success: true, message: 'Reported! ' + (type === 'lost' ? 'We\'ll notify you if someone reports finding it.' : 'Thanks for reporting — the owner can now find it here.'), item });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// PATCH /api/lostfound/:id/claim — someone claims a "found" item, or the
// reporter of a "lost" item marks it recovered. Notifies the reporter.
router.patch('/:id/claim', protect, async (req, res) => {
  try {
    const item = await LostFound.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    if (item.status !== 'open')
      return res.status(400).json({ success: false, message: 'This item has already been ' + item.status + '.' });

    item.status = 'claimed';
    item.claimedBy = req.user._id;
    item.claimedByName = req.user.name;
    if (req.body.note) item.resolvedNote = sanitizeString(req.body.note);
    await item.save();

    if (String(item.reporterId) !== String(req.user._id)) {
      createNotification(
        item.reporterId,
        'Lost & Found update',
        `${req.user.name} claimed your ${item.type === 'lost' ? 'lost' : 'found'} item report: "${item.itemName}". Coordinate pickup with the Guard desk.`,
        'system', item._id, 'medium'
      );
    }
    res.json({ success: true, message: 'Marked as claimed — coordinate handover at the Guard desk.', item });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// PATCH /api/lostfound/:id/close — reporter or guard/campus admin closes the listing
router.patch('/:id/close', protect, async (req, res) => {
  try {
    const item = await LostFound.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    const isOwner = String(item.reporterId) === String(req.user._id);
    const isStaff = ['guard', 'campus_admin', 'hostel_admin'].includes(req.user.role);
    if (!isOwner && !isStaff)
      return res.status(403).json({ success: false, message: 'Not authorized to close this listing.' });

    item.status = 'closed';
    if (req.body.note) item.resolvedNote = sanitizeString(req.body.note);
    await item.save();
    res.json({ success: true, message: 'Listing closed.', item });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// DELETE /api/lostfound/:id — reporter deletes their own listing (posted by mistake etc.)
router.delete('/:id', protect, async (req, res) => {
  try {
    const item = await LostFound.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    const isOwner = String(item.reporterId) === String(req.user._id);
    const isStaff = ['guard', 'campus_admin'].includes(req.user.role);
    if (!isOwner && !isStaff)
      return res.status(403).json({ success: false, message: 'Not authorized to delete this listing.' });
    await item.deleteOne();
    res.json({ success: true, message: 'Listing deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
