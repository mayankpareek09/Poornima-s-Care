const express      = require('express');
const router       = express.Router();
const StoreProduct = require('../models/StoreProduct');
const StoreOrder   = require('../models/StoreOrder');
const { protect, requireRole } = require('../middleware/auth');
const { sanitizeBody } = require('../utils/apiHelpers');

const ADMIN_ROLES = ['store_admin','campus_admin','super_admin'];

// ────────────────────────────────────────────────
//  PRODUCTS
// ────────────────────────────────────────────────

// GET /api/store/products?type=store|stationery
router.get('/products', async (req, res) => {
  try {
    const type = req.query.type === 'stationery' ? 'stationery' : 'store';
    const products = await StoreProduct.find({ type }).sort({ category:1, sortOrder:1, name:1 });
    res.json({ success: true, products });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// POST /api/store/products
router.post('/products', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { type, name, category, price, description, sizes, stock, imageEmoji, sortOrder } = req.body;
    if (!name || !category || price == null)
      return res.status(400).json({ success:false, message:'name, category, price required' });
    const product = await StoreProduct.create({
      type: type === 'stationery' ? 'stationery' : 'store',
      name, category, price, description,
      sizes: Array.isArray(sizes) ? sizes : [],
      stock: stock ?? 999, imageEmoji, sortOrder
    });
    res.status(201).json({ success:true, product });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// PATCH /api/store/products/:id
router.patch('/products/:id', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const product = await StoreProduct.findByIdAndUpdate(req.params.id, sanitizeBody(req.body), { new:true });
    if (!product) return res.status(404).json({ success:false, message:'Product not found' });
    res.json({ success:true, product });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// DELETE /api/store/products/:id
router.delete('/products/:id', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    await StoreProduct.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Product removed' });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// POST /api/store/products/seed?type=store|stationery
router.post('/products/seed', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const type = req.query.type === 'stationery' ? 'stationery' : 'store';
    const exists = await StoreProduct.countDocuments({ type });
    if (exists > 0) return res.json({ success:false, message:`${type} already seeded.` });

    const storeItems = [
      { type:'store', name:'College T-Shirt',     category:'T-Shirt',    price:250, sizes:['S','M','L','XL','XXL'], imageEmoji:'👕', sortOrder:1, description:'Official PU branded T-shirt' },
      { type:'store', name:'Formal Uniform Shirt',category:'Uniform',    price:450, sizes:['S','M','L','XL','XXL'], imageEmoji:'👔', sortOrder:2 },
      { type:'store', name:'College Hoodie',      category:'Hoodie',     price:650, sizes:['S','M','L','XL','XXL'], imageEmoji:'🧥', sortOrder:3 },
      { type:'store', name:'Varsity Jacket',      category:'Jacket',     price:900, sizes:['S','M','L','XL','XXL'], imageEmoji:'🧥', sortOrder:4 },
      { type:'store', name:'College Cap',         category:'Cap',        price:150, sizes:['Free Size'],            imageEmoji:'🧢', sortOrder:5 },
      { type:'store', name:'Sports Kit (Full)',   category:'Sports Kit', price:800, sizes:['S','M','L','XL'],       imageEmoji:'🏃', sortOrder:6, description:'Track pants + T-shirt' },
    ];
    const stationeryItems = [
      { type:'stationery', name:'Lab Notebook (60 pages)',   category:'Lab Notebook',     price:40,  imageEmoji:'📓', sortOrder:1 },
      { type:'stationery', name:'Lab Notebook (120 pages)',  category:'Lab Notebook',     price:70,  imageEmoji:'📓', sortOrder:2 },
      { type:'stationery', name:'Lecture Notebook (Single)', category:'Lecture Notebook', price:30,  imageEmoji:'📔', sortOrder:3 },
      { type:'stationery', name:'Lecture Notebook (Set of 5)',category:'Lecture Notebook',price:130, imageEmoji:'📔', sortOrder:4 },
      { type:'stationery', name:'Practical File',             category:'Practical File',  price:50,  imageEmoji:'📁', sortOrder:5 },
      { type:'stationery', name:'Assignment Sheet Bundle',    category:'Assignment Sheet',price:25,  imageEmoji:'📄', sortOrder:6 },
      { type:'stationery', name:'Student ID Card (Print)',    category:'ID Card',         price:100, imageEmoji:'🪪', sortOrder:7, description:'New / Lost / Damaged replacement' },
    ];

    const seedData = type === 'stationery' ? stationeryItems : storeItems;
    await StoreProduct.insertMany(seedData);
    res.json({ success:true, message:`Seeded ${seedData.length} ${type} items` });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// ────────────────────────────────────────────────
//  ORDERS
// ────────────────────────────────────────────────

// POST /api/store/orders
router.post('/orders', protect, async (req, res) => {
  try {
    const { type, items, note, idCardReason } = req.body; // items: [{productId, size, qty}]
    const orderType = type === 'stationery' ? 'stationery' : 'store';
    if (!items || !items.length)
      return res.status(400).json({ success:false, message:'Cart is empty.' });

    let total = 0;
    const orderItems = [];
    const stockDecrements = []; // track what we've already decremented, to roll back if a later item in the same order fails
    try {
      for (const { productId, size, qty } of items) {
        const dbItem = await StoreProduct.findById(productId);
        if (!dbItem) return res.status(400).json({ success:false, message:`Item not found` });
        if (!dbItem.isAvailable) return res.status(400).json({ success:false, message:`"${dbItem.name}" not available.` });
        if (dbItem.sizes.length && !size)
          return res.status(400).json({ success:false, message:`Please select a size for "${dbItem.name}"` });
        const q = Math.min(Math.max(1, qty), 10);

        // Atomic conditional decrement — only succeeds if enough stock is
        // still available at the moment of the write, so two students
        // ordering the last item concurrently can't both succeed.
        const decremented = await StoreProduct.findOneAndUpdate(
          { _id: dbItem._id, stock: { $gte: q } },
          { $inc: { stock: -q } },
          { new: true }
        );
        if (!decremented) {
          // Roll back anything already decremented earlier in this same order
          for (const rb of stockDecrements) await StoreProduct.findByIdAndUpdate(rb.productId, { $inc: { stock: rb.qty } });
          return res.status(400).json({ success:false, message:`"${dbItem.name}" — only ${dbItem.stock} left in stock.` });
        }
        stockDecrements.push({ productId: dbItem._id, qty: q });

        const sub = dbItem.price * q;
        total += sub;
        orderItems.push({ productId: dbItem._id, name: dbItem.name, size: size || '', price: dbItem.price, qty: q, subtotal: sub });
      }
    } catch (stockErr) {
      for (const rb of stockDecrements) await StoreProduct.findByIdAndUpdate(rb.productId, { $inc: { stock: rb.qty } });
      throw stockErr;
    }

    const order = await StoreOrder.create({
      type: orderType,
      studentId: req.user._id,
      studentName: req.user.name,
      studentUserId: req.user.userId,
      items: orderItems, total,
      note: note || '',
      idCardReason: idCardReason || '',
    });

    res.status(201).json({ success:true, message:`Order placed! Order ID: ${order.orderId}`, order });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// GET /api/store/orders/my?type=store|stationery
router.get('/orders/my', protect, async (req, res) => {
  try {
    const type = req.query.type === 'stationery' ? 'stationery' : 'store';
    const orders = await StoreOrder.find({ studentId: req.user._id, type }).sort({ createdAt:-1 }).limit(20);
    res.json({ success:true, orders });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// GET /api/store/orders?type=store|stationery&status=
router.get('/orders', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const type = req.query.type === 'stationery' ? 'stationery' : 'store';
    const { status } = req.query;
    const query = { type };
    if (status) query.status = status;
    const orders = await StoreOrder.find(query).sort({ createdAt:-1 }).limit(300);
    const revenue = orders.reduce((s,o)=>o.status!=='cancelled'?s+o.total:s,0);
    res.json({ success:true, orders, revenue });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// PATCH /api/store/orders/:id
router.patch('/orders/:id', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['processing','ready','collected','cancelled'].includes(status))
      return res.status(400).json({ success:false, message:'Invalid status' });
    const order = await StoreOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ success:false, message:'Order not found' });

    // Cancelling an order releases the stock it was holding back, so the
    // count doesn't permanently drift low from cancelled orders.
    if (status === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.items) {
        await StoreProduct.findByIdAndUpdate(item.productId, { $inc: { stock: item.qty } });
      }
    }

    order.status = status;
    if (status === 'collected') order.collectedAt = new Date();
    await order.save();
    res.json({ success:true, order });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

// GET /api/store/stats?type=store|stationery
router.get('/stats', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const type = req.query.type === 'stationery' ? 'stationery' : 'store';
    const [total,paid,processing,ready,collected,cancelled] = await Promise.all([
      StoreOrder.countDocuments({ type }),
      StoreOrder.countDocuments({ type, status:'paid' }),
      StoreOrder.countDocuments({ type, status:'processing' }),
      StoreOrder.countDocuments({ type, status:'ready' }),
      StoreOrder.countDocuments({ type, status:'collected' }),
      StoreOrder.countDocuments({ type, status:'cancelled' }),
    ]);
    const rev = await StoreOrder.aggregate([
      { $match:{ type, status:{$ne:'cancelled'} } },
      { $group:{ _id:null, total:{$sum:'$total'} } }
    ]);
    res.json({ success:true, stats:{ total,paid,processing,ready,collected,cancelled, revenue: rev[0]?.total||0 } });
  } catch(e) { res.status(500).json({ success:false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : e.message }); }
});

module.exports = router;
