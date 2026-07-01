const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { protect } = require('../middleware/auth');

const ADMIN_ROLES = ['academic_admin','hostel_admin','campus_admin'];

// GET /api/analytics — returns stats for admin dashboard
router.get('/', protect, async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role))
      return res.status(403).json({ success: false, message: 'Admins only.' });

    const roleFilter = { routedTo: req.user.role };

    const [total, open, inprogress, resolved] = await Promise.all([
      Complaint.countDocuments(roleFilter),
      Complaint.countDocuments({ ...roleFilter, status: 'open' }),
      Complaint.countDocuments({ ...roleFilter, status: 'inprogress' }),
      Complaint.countDocuments({ ...roleFilter, status: 'resolved' }),
    ]);

    // Avg resolution time (resolved complaints)
    const resolvedDocs = await Complaint.find({ ...roleFilter, status: 'resolved', resolvedAt: { $exists: true } })
      .select('createdAt resolvedAt').lean();
    const avgMs = resolvedDocs.length
      ? resolvedDocs.reduce((s, d) => s + (new Date(d.resolvedAt) - new Date(d.createdAt)), 0) / resolvedDocs.length
      : 0;
    const avgHours = Math.round(avgMs / 1000 / 3600);

    // Category breakdown
    const catAgg = await Complaint.aggregate([
      { $match: roleFilter },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Last 7 days trend
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const trend = await Complaint.aggregate([
      { $match: { ...roleFilter, createdAt: { $gte: sevenDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      stats: { total, open, inprogress, resolved,
        resolutionRate: total ? Math.round((resolved / total) * 100) : 0,
        avgResolutionHours: avgHours,
      },
      categoryBreakdown: catAgg,
      trend,
    });
  } catch(err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
