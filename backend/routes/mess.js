const express   = require('express');
const router    = express.Router();
const MessMenu  = require('../models/MessMenu');
const MessToken = require('../models/MessToken');
const { protect, requireRole } = require('../middleware/auth');

const ADMIN_ROLES = ['mess_admin','hostel_admin','campus_admin','super_admin'];
const MEAL_PRICES = { breakfast:30, lunch:60, snacks:20, dinner:50 };

// GET /api/mess/menu
router.get('/menu', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0,10);
    let menu = await MessMenu.findOne({ date });
    if (!menu) menu = {
      date,
      breakfast: { items:'Not posted yet', timing:'7:30 AM – 9:00 AM' },
      lunch:     { items:'Not posted yet', timing:'12:30 PM – 2:00 PM' },
      snacks:    { items:'Not posted yet', timing:'5:00 PM – 6:00 PM' },
      dinner:    { items:'Not posted yet', timing:'7:30 PM – 9:00 PM' },
      notice: '',
    };
    res.json({ success:true, menu, prices: MEAL_PRICES });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// POST /api/mess/menu
router.post('/menu', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { date, breakfast, lunch, snacks, dinner, notice } = req.body;
    const d = date || new Date().toISOString().slice(0,10);
    const menu = await MessMenu.findOneAndUpdate(
      { date: d },
      { date:d, breakfast, lunch, snacks, dinner, notice:notice||'', postedBy:req.user.name },
      { upsert:true, new:true }
    );
    res.json({ success:true, message:'Menu updated!', menu });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// POST /api/mess/tokens
router.post('/tokens', protect, async (req, res) => {
  try {
    const { meal, userType } = req.body;
    if (!['breakfast','lunch','snacks','dinner'].includes(meal))
      return res.status(400).json({ success:false, message:'Invalid meal' });
    if (!['day_scholar','staff'].includes(userType))
      return res.status(400).json({ success:false, message:'userType must be day_scholar or staff' });

    const date = new Date().toISOString().slice(0,10);
    const dup = await MessToken.findOne({ userId:req.user._id, meal, date, status:'active' });
    if (dup) return res.status(409).json({ success:false, message:`Already have a ${meal} token today: ${dup.token}` });

    const token = await MessToken.create({
      userId: req.user._id,
      userName: req.user.name,
      userRegNo: req.user.userId,
      userType, meal, date,
      price: MEAL_PRICES[meal],
    });
    res.status(201).json({ success:true, message:`Token issued: ${token.token}`, token });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// GET /api/mess/tokens/my
router.get('/tokens/my', protect, async (req, res) => {
  try {
    const tokens = await MessToken.find({ userId:req.user._id }).sort({ createdAt:-1 }).limit(30);
    res.json({ success:true, tokens });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// GET /api/mess/tokens
router.get('/tokens', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0,10);
    const tokens = await MessToken.find({ date }).sort({ meal:1, createdAt:1 });
    const summary = { breakfast:0, lunch:0, snacks:0, dinner:0, totalRevenue:0 };
    tokens.forEach(t => { if(t.status!=='expired'){ summary[t.meal]=(summary[t.meal]||0)+1; summary.totalRevenue+=t.price; } });
    res.json({ success:true, tokens, summary });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// PATCH /api/mess/tokens/verify
router.patch('/tokens/verify', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success:false, message:'Token code required' });
    const t = await MessToken.findOne({ token });
    if (!t) return res.status(404).json({ success:false, message:'Token not found' });
    const today = new Date().toISOString().slice(0,10);
    if (t.date !== today) return res.status(400).json({ success:false, message:`Token expired — valid for ${t.date}` });
    if (t.status==='used') return res.status(409).json({ success:false, message:`Already used at ${t.verifiedAt?.toLocaleTimeString('en-IN')}` });
    if (t.status==='expired') return res.status(400).json({ success:false, message:'Token expired' });
    t.status='used'; t.verifiedBy=req.user.name; t.verifiedAt=new Date();
    await t.save();
    res.json({ success:true, message:`✅ Valid! Entry granted for ${t.userName} — ${t.meal}`, token:t });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

module.exports = router;