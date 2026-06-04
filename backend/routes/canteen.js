const express  = require('express');
const router   = express.Router();
const CanteenItem  = require('../models/CanteenItem');
const CanteenOrder = require('../models/CanteenOrder');
const { protect, requireRole } = require('../middleware/auth');

const ADMIN_ROLES = ['canteen_admin','campus_admin','super_admin'];

// GET /api/canteen/items
router.get('/items', async (req, res) => {
  try {
    const items = await CanteenItem.find({}).sort({ category:1, sortOrder:1, name:1 });
    res.json({ success: true, items });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// POST /api/canteen/items
router.post('/items', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { name, category, price, description, isVeg, imageEmoji, sortOrder } = req.body;
    if (!name || !category || price == null)
      return res.status(400).json({ success:false, message:'name, category, price required' });
    const item = await CanteenItem.create({ name, category, price, description, isVeg, imageEmoji, sortOrder });
    res.status(201).json({ success:true, item });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// PATCH /api/canteen/items/:id
router.patch('/items/:id', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const item = await CanteenItem.findByIdAndUpdate(req.params.id, req.body, { new:true });
    if (!item) return res.status(404).json({ success:false, message:'Item not found' });
    res.json({ success:true, item });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// DELETE /api/canteen/items/:id
router.delete('/items/:id', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    await CanteenItem.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Item removed' });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// POST /api/canteen/items/seed
router.post('/items/seed', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const exists = await CanteenItem.countDocuments();
    if (exists > 0) return res.json({ success:false, message:'Menu already seeded.' });
    const menu = [
      { name:'Samosa',         category:'Snacks', price:10, imageEmoji:'🥟', sortOrder:1 },
      { name:'Bread Pakoda',   category:'Snacks', price:15, imageEmoji:'🍞', sortOrder:2 },
      { name:'Poha',           category:'Snacks', price:20, imageEmoji:'🍚', sortOrder:3 },
      { name:'Chips (Pack)',   category:'Snacks', price:20, imageEmoji:'🍟', sortOrder:4 },
      { name:'Biscuit (Pack)', category:'Snacks', price:10, imageEmoji:'🍪', sortOrder:5 },
      { name:'Chai',           category:'Drinks', price:10, imageEmoji:'☕', sortOrder:1 },
      { name:'Cold Coffee',    category:'Drinks', price:30, imageEmoji:'🥤', sortOrder:2 },
      { name:'Pepsi / Sprite', category:'Drinks', price:20, imageEmoji:'🥤', sortOrder:3 },
      { name:'Juice Packet',   category:'Drinks', price:15, imageEmoji:'🧃', sortOrder:4 },
      { name:'Water Bottle',   category:'Drinks', price:15, imageEmoji:'💧', sortOrder:5 },
      { name:'Maggi Regular',  category:'Meals',  price:30, imageEmoji:'🍜', sortOrder:1 },
      { name:'Maggi Cheese',   category:'Meals',  price:40, imageEmoji:'🍜', sortOrder:2 },
      { name:'Rice + Dal',     category:'Meals',  price:50, imageEmoji:'🍛', sortOrder:3 },
      { name:'Rajma Chawal',   category:'Meals',  price:60, imageEmoji:'🥘', sortOrder:4 },
      { name:'Paneer Roti',    category:'Meals',  price:50, imageEmoji:'🫓', sortOrder:5 },
      { name:'Study Combo',    category:'Combos', price:50, imageEmoji:'📚', sortOrder:1, description:'Maggi + Chai + Biscuit' },
      { name:'Full Meal Deal', category:'Combos', price:80, imageEmoji:'🍱', sortOrder:2, description:'Rice + Dal + Roti + Juice' },
    ];
    await CanteenItem.insertMany(menu);
    res.json({ success:true, message:`Seeded ${menu.length} items` });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// POST /api/canteen/orders
router.post('/orders', protect, async (req, res) => {
  try {
    const { items, note } = req.body;
    if (!items || !items.length)
      return res.status(400).json({ success:false, message:'Cart is empty.' });

    const recent = await CanteenOrder.findOne({
      studentId: req.user._id,
      status: { $in: ['paid','preparing','ready'] },
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
    });
    if (recent)
      return res.status(429).json({ success:false, message:`Active order exists: ${recent.token}. Collect it first.` });

    let total = 0;
    const orderItems = [];
    for (const { itemId, qty } of items) {
      const dbItem = await CanteenItem.findById(itemId);
      if (!dbItem) return res.status(400).json({ success:false, message:`Item not found` });
      if (!dbItem.isAvailable) return res.status(400).json({ success:false, message:`"${dbItem.name}" not available.` });
      const q = Math.min(Math.max(1, qty), 10);
      const sub = dbItem.price * q;
      total += sub;
      orderItems.push({ itemId: dbItem._id, name: dbItem.name, price: dbItem.price, qty: q, subtotal: sub });
    }

    const order = await CanteenOrder.create({
      studentId: req.user._id,
      studentName: req.user.name,
      studentUserId: req.user.userId,
      items: orderItems, total, note: note || '',
    });

    res.status(201).json({ success:true, message:`Order placed! Token: ${order.token}`, order });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// GET /api/canteen/orders/my
router.get('/orders/my', protect, async (req, res) => {
  try {
    const orders = await CanteenOrder.find({ studentId: req.user._id }).sort({ createdAt:-1 }).limit(20);
    res.json({ success:true, orders });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// GET /api/canteen/orders
router.get('/orders', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { date, status } = req.query;
    const query = {};
    if (status) query.status = status;
    if (date) {
      const d = new Date(date); const next = new Date(d); next.setDate(next.getDate()+1);
      query.createdAt = { $gte: d, $lt: next };
    } else {
      const today = new Date(); today.setHours(0,0,0,0);
      query.createdAt = { $gte: today };
    }
    const orders = await CanteenOrder.find(query).sort({ createdAt:-1 });
    const todayRevenue = orders.reduce((s,o)=>o.status!=='cancelled'?s+o.total:s,0);
    res.json({ success:true, orders, todayRevenue });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// PATCH /api/canteen/orders/:id
router.patch('/orders/:id', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['preparing','ready','collected','cancelled'].includes(status))
      return res.status(400).json({ success:false, message:'Invalid status' });
    const update = { status };
    if (status === 'collected') update.collectedAt = new Date();
    const order = await CanteenOrder.findByIdAndUpdate(req.params.id, update, { new:true });
    if (!order) return res.status(404).json({ success:false, message:'Order not found' });
    res.json({ success:true, order });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// GET /api/canteen/stats
router.get('/stats', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [total,paid,preparing,ready,collected,cancelled] = await Promise.all([
      CanteenOrder.countDocuments({ createdAt:{$gte:today} }),
      CanteenOrder.countDocuments({ createdAt:{$gte:today}, status:'paid' }),
      CanteenOrder.countDocuments({ createdAt:{$gte:today}, status:'preparing' }),
      CanteenOrder.countDocuments({ createdAt:{$gte:today}, status:'ready' }),
      CanteenOrder.countDocuments({ createdAt:{$gte:today}, status:'collected' }),
      CanteenOrder.countDocuments({ createdAt:{$gte:today}, status:'cancelled' }),
    ]);
    const rev = await CanteenOrder.aggregate([
      { $match:{ createdAt:{$gte:today}, status:{$ne:'cancelled'} } },
      { $group:{ _id:null, total:{$sum:'$total'} } }
    ]);
    res.json({ success:true, stats:{ total,paid,preparing,ready,collected,cancelled, revenue: rev[0]?.total||0 } });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

module.exports = router;