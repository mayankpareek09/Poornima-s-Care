const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, requireRole } = require('../middleware/auth');
const { escapeRegex } = require('../utils/sanitize');

// Inline schema — no separate file needed
const materialSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  subject:     { type: String, required: true, trim: true },
  course:      { type: String, default: '' },
  semester:    { type: String, default: '' },
  type:        { type: String, enum: ['notes','pyq','syllabus','book','assignment','other'], default: 'notes' },
  description: { type: String, default: '' },
  fileUrl:     { type: String, default: '' },      // link to uploaded file / Google Drive
  externalUrl: { type: String, default: '' },      // any external link
  uploadedBy:  { type: String },
  uploadedById:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploaderRole:{ type: String, default: 'student' },
  uploaderCourse:{ type: String, default: '' },
  uploaderYear:{ type: String, default: '' },
  isApproved:  { type: Boolean, default: true },
  downloads:   { type: Number, default: 0 },
  tags:        [String],
}, { timestamps: true });

const Material = mongoose.models.Material || mongoose.model('Material', materialSchema);

// GET /api/materials — PUBLIC
router.get('/', async (req, res) => {
  try {
    const { course, semester, type, subject, q } = req.query;
    const query = { isApproved: true };
    if (course)   query.course   = course;
    if (semester) query.semester = semester;
    if (type)     query.type     = type;
    if (subject)  query.subject  = new RegExp(escapeRegex(subject), 'i');
    if (q) {
      const safeQ = escapeRegex(q);
      query.$or = [{ title: new RegExp(safeQ,'i') }, { subject: new RegExp(safeQ,'i') }, { tags: new RegExp(safeQ,'i') }];
    }
    const materials = await Material.find(query).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, materials });
  } catch(err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/materials — any logged in user can upload
router.post('/', protect, async (req, res) => {
  try {
    const { title, subject, course, semester, type, description, fileUrl, externalUrl, tags } = req.body;
    if (!title || !subject) return res.status(400).json({ success: false, message: 'Title and subject are required.' });
    const mat = await Material.create({
      title, subject, course, semester, type, description, fileUrl, externalUrl,
      tags: tags || [], uploadedBy: req.user.name, uploadedById: req.user._id,
      uploaderRole: req.user.role || 'student',
      uploaderCourse: req.user.course || '',
      uploaderYear: req.user.year || '',
    });
    res.status(201).json({ success: true, message: 'Material uploaded!', material: mat });
  } catch(err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// PATCH /api/materials/:id/download — increment counter
router.patch('/:id/download', async (req, res) => {
  try {
    await Material.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// DELETE /api/materials/:id — owner or admin
router.delete('/:id', protect, async (req, res) => {
  try {
    const mat = await Material.findById(req.params.id);
    if (!mat) return res.status(404).json({ success: false, message: 'Not found.' });
    const isAdmin = ['academic_admin','campus_admin'].includes(req.user.role);
    const isOwner = mat.uploadedById?.toString() === req.user._id.toString();
    if (!isAdmin && !isOwner) return res.status(403).json({ success: false, message: 'Access denied.' });
    await mat.deleteOne();
    res.json({ success: true, message: 'Deleted.' });
  } catch(err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
