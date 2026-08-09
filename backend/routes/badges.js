const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const Laundry = require('../models/Laundry');
const Event = require('../models/Event');
const Suggestion = require('../models/Suggestion');
const Feedback = require('../models/Feedback');
const Appointment = require('../models/Appointment');
const LostFound = require('../models/LostFound');
const { protect, requireRole } = require('../middleware/auth');

// Badges are computed live from real activity — nothing fabricated, nothing
// stored separately that could drift out of sync with the actual data.
const BADGE_DEFS = [
  { id: 'problem_solver', name: 'Problem Solver', icon: '🏆', threshold: 3, desc: 'Get 3+ complaints resolved' },
  { id: 'laundry_regular', name: 'Laundry Regular', icon: '👕', threshold: 5, desc: 'Complete 5+ wash cycles' },
  { id: 'event_enthusiast', name: 'Event Enthusiast', icon: '🎉', threshold: 3, desc: 'Register for 3+ campus events' },
  { id: 'idea_machine', name: 'Idea Machine', icon: '💡', threshold: 3, desc: 'Post 3+ suggestions' },
  { id: 'feedback_champion', name: 'Feedback Champion', icon: '⭐', threshold: 2, desc: 'Submit 2+ monthly feedback forms' },
  { id: 'appointment_pro', name: 'Appointment Pro', icon: '📅', threshold: 2, desc: 'Have 2+ faculty appointments accepted' },
  { id: 'good_samaritan', name: 'Good Samaritan', icon: '🔍', threshold: 1, desc: 'Report a found item that gets claimed by its owner' },
];

router.get('/my', protect, requireRole('student'), async (req, res) => {
  try {
    const uid = req.user._id;
    const [resolvedComplaints, laundryRec, eventsRegistered, suggestionsPosted, feedbackCount, appointmentsAccepted, foundClaimed] = await Promise.all([
      Complaint.countDocuments({ studentId: uid, status: 'resolved' }),
      Laundry.findOne({ studentId: uid }).select('usedWashes'),
      Event.countDocuments({ registeredStudents: uid }),
      Suggestion.countDocuments({ authorId: uid }),
      Feedback.countDocuments({ studentId: uid }),
      Appointment.countDocuments({ studentId: uid, status: 'accepted' }),
      LostFound.countDocuments({ reporterId: uid, type: 'found', status: 'claimed' }),
    ]);

    const progress = {
      problem_solver: resolvedComplaints,
      laundry_regular: laundryRec?.usedWashes || 0,
      event_enthusiast: eventsRegistered,
      idea_machine: suggestionsPosted,
      feedback_champion: feedbackCount,
      appointment_pro: appointmentsAccepted,
      good_samaritan: foundClaimed,
    };

    const badges = BADGE_DEFS.map(b => ({
      ...b,
      current: progress[b.id] || 0,
      earned: (progress[b.id] || 0) >= b.threshold,
    }));

    res.json({ success: true, badges, earnedCount: badges.filter(b => b.earned).length, totalCount: badges.length });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
