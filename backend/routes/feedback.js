const express  = require('express');
const router   = express.Router();
const Feedback = require('../models/Feedback');
const { protect, requireRole } = require('../middleware/auth');

const ADMIN_ROLES = ['academic_admin','hostel_admin','campus_admin','super_admin'];
const CATEGORIES  = Feedback.CATEGORIES;

function currentMonth() { return new Date().toISOString().slice(0,7); } // YYYY-MM

// POST /api/feedback — submit or update this month's feedback
router.post('/', protect, async (req, res) => {
  try {
    const { ratings, comment } = req.body;
    if (!ratings || typeof ratings !== 'object')
      return res.status(400).json({ success:false, message:'Ratings are required.' });

    // Validate each provided rating is 1-5
    for (const key of Object.keys(ratings)) {
      if (!CATEGORIES.includes(key)) continue;
      const v = ratings[key];
      if (v != null && (v < 1 || v > 5))
        return res.status(400).json({ success:false, message:`Invalid rating for ${key}. Must be 1-5.` });
    }

    const month = currentMonth();
    const feedback = await Feedback.findOneAndUpdate(
      { studentId: req.user._id, month },
      { studentId: req.user._id, studentName: req.user.name, month, ratings, comment: comment || '' },
      { upsert: true, new: true }
    );
    res.status(201).json({ success:true, message:'Thanks for your feedback!', feedback });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// GET /api/feedback/my — this month's feedback if already submitted
router.get('/my', protect, async (req, res) => {
  try {
    const month = currentMonth();
    const feedback = await Feedback.findOne({ studentId: req.user._id, month });
    res.json({ success:true, feedback: feedback || null, month });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// GET /api/feedback/analytics?month=YYYY-MM — admin sees averages per category
router.get('/analytics', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const month = req.query.month || currentMonth();
    const all = await Feedback.find({ month });

    const averages = {};
    CATEGORIES.forEach(cat => {
      const values = all.map(f => f.ratings?.[cat]).filter(v => v != null);
      averages[cat] = values.length ? +(values.reduce((s,v)=>s+v,0) / values.length).toFixed(2) : null;
    });

    const comments = all.filter(f => f.comment).map(f => ({ studentName: f.studentName, comment: f.comment, createdAt: f.createdAt }));

    res.json({ success:true, month, totalResponses: all.length, averages, comments });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// GET /api/feedback/trend?months=6 — admin sees trend over recent months
router.get('/trend', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const monthsBack = parseInt(req.query.months) || 6;
    const months = [];
    const now = new Date();
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0,7));
    }

    const trend = [];
    for (const month of months) {
      const all = await Feedback.find({ month });
      let overallSum = 0, overallCount = 0;
      all.forEach(f => CATEGORIES.forEach(cat => {
        if (f.ratings?.[cat] != null) { overallSum += f.ratings[cat]; overallCount++; }
      }));
      trend.push({ month, responses: all.length, avgOverall: overallCount ? +(overallSum/overallCount).toFixed(2) : null });
    }
    res.json({ success:true, trend });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

module.exports = router;
