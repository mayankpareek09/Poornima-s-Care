const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');
const { protect, requireRole } = require('../middleware/auth');
const { sanitizeString } = require('../utils/apiHelpers');

const CREATOR_ROLES = ['council_admin', 'club_captain', 'academic_admin', 'campus_admin', 'super_admin'];

function stripVoters(poll, userId) {
  const obj = poll.toObject ? poll.toObject({ virtuals: true }) : poll;
  const mine = (obj.voters || []).find(v => String(v.userId) === String(userId));
  obj.myVote = mine ? mine.option : null;
  obj.voterCount = (obj.voters || []).length;
  delete obj.voters; // don't leak who-voted-for-what to regular viewers
  return obj;
}

// GET /api/polls — list polls (default: active only)
router.get('/', protect, async (req, res) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : { status: 'active' };
    const polls = await Poll.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, polls: polls.map(p => stripVoters(p, req.user._id)) });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/polls — create a poll (council/club/academic/campus/super admin)
router.post('/', protect, requireRole(...CREATOR_ROLES), async (req, res) => {
  try {
    const { question, options, closesAt } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ success: false, message: 'Question is required.' });
    const cleanOptions = (options || []).map(o => sanitizeString(String(o))).filter(o => o.length > 0);
    if (cleanOptions.length < 2) return res.status(400).json({ success: false, message: 'At least 2 options are required.' });
    if (cleanOptions.length > 8) return res.status(400).json({ success: false, message: 'Maximum 8 options.' });

    const poll = await Poll.create({
      question: sanitizeString(question),
      options: cleanOptions.map(text => ({ text, votes: 0 })),
      createdBy: req.user._id, createdByName: req.user.name, createdByRole: req.user.role,
      closesAt: closesAt || null,
    });
    res.status(201).json({ success: true, message: 'Poll created.', poll: stripVoters(poll, req.user._id) });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// PATCH /api/polls/:id/vote
router.patch('/:id/vote', protect, async (req, res) => {
  try {
    const { option } = req.body;
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found.' });
    if (poll.status !== 'active') return res.status(400).json({ success: false, message: 'This poll is closed.' });
    if (typeof option !== 'number' || option < 0 || option >= poll.options.length)
      return res.status(400).json({ success: false, message: 'Invalid option.' });
    if (poll.voters.some(v => String(v.userId) === String(req.user._id)))
      return res.status(400).json({ success: false, message: 'You already voted on this poll.' });

    poll.options[option].votes += 1;
    poll.voters.push({ userId: req.user._id, option });
    await poll.save();
    res.json({ success: true, message: 'Vote recorded!', poll: stripVoters(poll, req.user._id) });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// PATCH /api/polls/:id/close — creator or admin closes the poll
router.patch('/:id/close', protect, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found.' });
    const isOwner = String(poll.createdBy) === String(req.user._id);
    const isAdmin = CREATOR_ROLES.includes(req.user.role);
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: 'Not authorized to close this poll.' });
    poll.status = 'closed';
    await poll.save();
    res.json({ success: true, message: 'Poll closed.', poll: stripVoters(poll, req.user._id) });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// DELETE /api/polls/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found.' });
    const isOwner = String(poll.createdBy) === String(req.user._id);
    if (!isOwner && !CREATOR_ROLES.includes(req.user.role)) return res.status(403).json({ success: false, message: 'Not authorized.' });
    await poll.deleteOne();
    res.json({ success: true, message: 'Poll deleted.' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
