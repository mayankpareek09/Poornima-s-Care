const express = require('express');
const router = express.Router();
const Opportunity = require('../models/Opportunity');
const OpportunityApplication = require('../models/OpportunityApplication');
const { protect, requireRole } = require('../middleware/auth');
const { sanitizeString } = require('../utils/apiHelpers');
const { createNotification } = require('../utils/notificationHelper');

// GET /api/opportunities — browse (any logged-in user). ?type=placement|internship
router.get('/', protect, async (req, res) => {
  try {
    const filter = { status: 'open', deadline: { $gte: new Date() } };
    if (req.query.type && ['placement', 'internship'].includes(req.query.type)) filter.type = req.query.type;
    if (req.query.includeClosed === '1') { delete filter.status; delete filter.deadline; }
    const opps = await Opportunity.find(filter).sort({ deadline: 1 }).limit(200);
    res.json({ success: true, opportunities: opps });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// GET /api/opportunities/my — student's applications
router.get('/my', protect, requireRole('student'), async (req, res) => {
  try {
    const apps = await OpportunityApplication.find({ studentId: req.user._id }).populate('opportunityId').sort({ createdAt: -1 });
    res.json({ success: true, applications: apps });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/opportunities/:id/apply
router.post('/:id/apply', protect, requireRole('student'), async (req, res) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ success: false, message: 'Opportunity not found.' });
    if (opp.status !== 'open' || opp.deadline < new Date())
      return res.status(400).json({ success: false, message: 'Applications are closed for this opportunity.' });

    const existing = await OpportunityApplication.findOne({ opportunityId: opp._id, studentId: req.user._id });
    if (existing) return res.status(400).json({ success: false, message: 'You already applied to this.' });

    const app = await OpportunityApplication.create({
      opportunityId: opp._id, studentId: req.user._id, studentName: req.user.name, studentUserId: req.user.userId,
    });
    res.status(201).json({ success: true, message: 'Application submitted!', application: app });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// ---- Placement admin management ----

router.post('/', protect, requireRole('placement_admin'), async (req, res) => {
  try {
    const { type, company, role, description, compensation, location, eligibility, driveDate, deadline } = req.body;
    if (!['placement', 'internship'].includes(type)) return res.status(400).json({ success: false, message: 'Type must be placement or internship.' });
    if (!company?.trim() || !role?.trim() || !deadline) return res.status(400).json({ success: false, message: 'Company, role, and deadline are required.' });

    const opp = await Opportunity.create({
      type, company: sanitizeString(company), role: sanitizeString(role), description: sanitizeString(description || ''),
      compensation: sanitizeString(compensation || ''), location: sanitizeString(location || ''),
      eligibility: sanitizeString(eligibility || ''), driveDate: driveDate || null, deadline, postedBy: req.user._id,
    });
    res.status(201).json({ success: true, message: 'Opportunity posted.', opportunity: opp });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

router.patch('/:id/close', protect, requireRole('placement_admin'), async (req, res) => {
  try {
    const opp = await Opportunity.findByIdAndUpdate(req.params.id, { status: 'closed' }, { new: true });
    if (!opp) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, message: 'Closed.', opportunity: opp });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

router.delete('/:id', protect, requireRole('placement_admin'), async (req, res) => {
  try {
    await Opportunity.findByIdAndDelete(req.params.id);
    await OpportunityApplication.deleteMany({ opportunityId: req.params.id });
    res.json({ success: true, message: 'Deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// GET /api/opportunities/:id/applicants (placement admin)
router.get('/:id/applicants', protect, requireRole('placement_admin'), async (req, res) => {
  try {
    const apps = await OpportunityApplication.find({ opportunityId: req.params.id }).sort({ createdAt: -1 });
    res.json({ success: true, applicants: apps });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// PATCH /api/opportunities/applications/:appId — update applicant status
router.patch('/applications/:appId', protect, requireRole('placement_admin'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['applied', 'shortlisted', 'selected', 'rejected'].includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    const app = await OpportunityApplication.findByIdAndUpdate(req.params.appId, { status, ...(notes !== undefined ? { notes: sanitizeString(notes) } : {}) }, { new: true });
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    const opp = await Opportunity.findById(app.opportunityId);
    createNotification(app.studentId, 'Placement/Internship update',
      `Your application for ${opp?.role || 'a role'} at ${opp?.company || ''} is now: ${status}.`, 'system', app._id, status === 'selected' ? 'high' : 'medium');

    res.json({ success: true, message: 'Applicant status updated.', application: app });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
