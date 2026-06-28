const express     = require('express');
const router      = express.Router();
const Suggestion  = require('../models/Suggestion');
const { protect, requireRole } = require('../middleware/auth');

const ADMIN_ROLES = ['academic_admin','hostel_admin','campus_admin','super_admin'];

// POST /api/suggestions — anyone logged in can post
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, category, isAnonymous } = req.body;
    if (!title || !description)
      return res.status(400).json({ success:false, message:'Title and description are required.' });

    const suggestion = await Suggestion.create({
      authorId: req.user._id,
      authorName: isAnonymous ? 'Anonymous' : req.user.name,
      isAnonymous: !!isAnonymous,
      title, description,
      category: category || 'Other',
    });
    res.status(201).json({ success:true, message:'Suggestion posted!', suggestion });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// GET /api/suggestions?sort=top|recent&category=&status=
router.get('/', protect, async (req, res) => {
  try {
    const { sort, category, status } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (status)   filter.status = status;

    let suggestions = await Suggestion.find(filter).lean();
    suggestions = suggestions.map(s => ({
      ...s,
      score: (s.likes?.length||0) - (s.dislikes?.length||0),
      likeCount: s.likes?.length||0,
      dislikeCount: s.dislikes?.length||0,
      userVote: s.likes?.some(id=>id.toString()===req.user._id.toString()) ? 'like'
              : s.dislikes?.some(id=>id.toString()===req.user._id.toString()) ? 'dislike' : null,
    }));

    if (sort === 'recent') suggestions.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    else suggestions.sort((a,b)=>b.score-a.score || new Date(b.createdAt)-new Date(a.createdAt));

    res.json({ success:true, suggestions });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// PATCH /api/suggestions/:id/vote — like or dislike
router.patch('/:id/vote', protect, async (req, res) => {
  try {
    const { vote } = req.body; // 'like' | 'dislike' | 'remove'
    if (!['like','dislike','remove'].includes(vote))
      return res.status(400).json({ success:false, message:'Invalid vote type' });

    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) return res.status(404).json({ success:false, message:'Suggestion not found' });

    const uid = req.user._id.toString();
    suggestion.likes    = suggestion.likes.filter(id => id.toString() !== uid);
    suggestion.dislikes = suggestion.dislikes.filter(id => id.toString() !== uid);

    if (vote === 'like')    suggestion.likes.push(req.user._id);
    if (vote === 'dislike') suggestion.dislikes.push(req.user._id);

    await suggestion.save();
    res.json({
      success:true,
      likeCount: suggestion.likes.length,
      dislikeCount: suggestion.dislikes.length,
      userVote: vote === 'remove' ? null : vote,
    });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// PATCH /api/suggestions/:id/status — admin moderation
router.patch('/:id/status', protect, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['open','under_review','implemented','rejected'].includes(status))
      return res.status(400).json({ success:false, message:'Invalid status' });

    const suggestion = await Suggestion.findByIdAndUpdate(
      req.params.id, { status, adminNote: adminNote || '' }, { new:true }
    );
    if (!suggestion) return res.status(404).json({ success:false, message:'Suggestion not found' });
    res.json({ success:true, message:`Marked as ${status.replace('_',' ')}`, suggestion });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

// DELETE /api/suggestions/:id — author or admin can delete
router.delete('/:id', protect, async (req, res) => {
  try {
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) return res.status(404).json({ success:false, message:'Not found' });
    const isAuthor = suggestion.authorId.toString() === req.user._id.toString();
    const isAdmin  = ADMIN_ROLES.includes(req.user.role);
    if (!isAuthor && !isAdmin) return res.status(403).json({ success:false, message:'Not allowed' });
    await Suggestion.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'Suggestion deleted' });
  } catch(e) { res.status(500).json({ success:false, message: e.message }); }
});

module.exports = router;
