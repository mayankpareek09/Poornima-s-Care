const express = require('express');
const router = express.Router();
const BusRoute = require('../models/BusRoute');
const { protect, requireRole } = require('../middleware/auth');

// GET /api/bus — any logged-in user
router.get('/', async (req, res) => {
  try {
    const routes = await BusRoute.find({ isActive: true }).sort({ routeNo: 1 });
    res.json({ success: true, routes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/bus — academic admin
router.post('/', protect, requireRole('academic_admin'), async (req, res) => {
  try {
    const route = await BusRoute.create({ ...req.body, updatedBy: req.user.name });
    res.status(201).json({ success: true, message: 'Bus route created!', route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/bus/:id — academic admin
router.put('/:id', protect, requireRole('academic_admin'), async (req, res) => {
  try {
    const route = await BusRoute.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user.name }, { new: true });
    if (!route) return res.status(404).json({ success: false, message: 'Route not found.' });
    res.json({ success: true, message: 'Bus route updated!', route });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/bus/:id — academic admin
router.delete('/:id', protect, requireRole('academic_admin'), async (req, res) => {
  try {
    await BusRoute.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Bus route deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
