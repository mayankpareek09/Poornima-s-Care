const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const { protect, requireRole } = require('../middleware/auth');
const { sanitizeString } = require('../utils/apiHelpers');

// GET /api/chat/messages — last 100, or ?since=<ISO timestamp> for polling new ones only
router.get('/messages', protect, async (req, res) => {
  try {
    if (req.query.since) {
      const msgs = await ChatMessage.find({ createdAt: { $gt: new Date(req.query.since) } }).sort({ createdAt: 1 }).limit(100);
      return res.json({ success: true, messages: msgs });
    }
    const msgs = await ChatMessage.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, messages: msgs.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/chat/messages
router.post('/messages', protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message cannot be empty.' });
    if (message.length > 500) return res.status(400).json({ success: false, message: 'Message too long (max 500 characters).' });

    const msg = await ChatMessage.create({
      senderId: req.user._id, senderName: req.user.name, senderRole: req.user.role, message: sanitizeString(message),
    });
    res.status(201).json({ success: true, chatMessage: msg });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// DELETE /api/chat/messages/:id — sender can delete their own, campus_admin can moderate any
router.delete('/messages/:id', protect, async (req, res) => {
  try {
    const msg = await ChatMessage.findById(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found.' });
    const isOwner = String(msg.senderId) === String(req.user._id);
    const isModerator = ['campus_admin', 'super_admin'].includes(req.user.role);
    if (!isOwner && !isModerator) return res.status(403).json({ success: false, message: 'Not authorized.' });
    await msg.deleteOne();
    res.json({ success: true, message: 'Message deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
