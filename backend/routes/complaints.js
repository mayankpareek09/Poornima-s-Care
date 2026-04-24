const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { protect, requireRole } = require('../middleware/auth');
const { createNotification, notifyAdmins, notifyAllAdmins } = require('../utils/notificationHelper');

const ADMIN_ROLES = ['academic_admin','hostel_admin','campus_admin'];

// ─── ESCALATION WORKER ───────────────────────────────────────────────
// Called by a cron/interval — escalates unresolved complaints after 24h
async function runEscalation() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago
    const stale = await Complaint.find({
      status: { $in: ['open','inprogress'] },
      escalationLevel: { $lt: 3 },
      createdAt: { $lt: cutoff },
      $or: [
        { lastEscalatedAt: { $exists: false } },
        { lastEscalatedAt: null },
        { lastEscalatedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
      ]
    });

    for (const complaint of stale) {
      const nextLevel = (complaint.escalationLevel || 0) + 1;
      const escalationRoles = ['hostel_admin','campus_admin','academic_admin'];
      const escalatedTo = escalationRoles[Math.min(nextLevel - 1, escalationRoles.length - 1)];

      complaint.escalationLevel = nextLevel;
      complaint.isEscalated = true;
      complaint.lastEscalatedAt = new Date();
      complaint.routedTo = escalatedTo;
      complaint.escalationHistory.push({
        level: nextLevel,
        escalatedTo,
        reason: `Auto-escalated: unresolved after ${nextLevel * 24} hours`,
      });
      await complaint.save();

      // Notify the escalated-to admin
      await notifyAdmins(
        escalatedTo,
        `⚠️ Escalated Complaint (L${nextLevel})`,
        `"${complaint.title}" has been escalated to your level after being unresolved for ${nextLevel * 24}h.`,
        'escalation', complaint._id, 'high'
      );
      // Notify student
      await createNotification(
        complaint.studentId,
        `Your complaint was escalated (Level ${nextLevel})`,
        `"${complaint.title}" has been escalated to higher authority as it remains unresolved.`,
        'escalation', complaint._id, 'medium'
      );
    }
    if (stale.length > 0) console.log(`✅ Escalated ${stale.length} complaint(s)`);
  } catch (err) {
    console.error('Escalation error:', err.message);
  }
}

// Run escalation check every 30 minutes
setInterval(runEscalation, 30 * 60 * 1000);

// ─── GET all complaints ───────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { role } = req.user;
    let query = {};

    if (role === 'student') {
      query.studentId = req.user._id;
    } else if (ADMIN_ROLES.includes(role)) {
      query.routedTo = role;
    } else {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const complaints = await Complaint.find(query).sort({ isSOS: -1, upvotes: -1, createdAt: -1 });
    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST new complaint ───────────────────────────────────────────────
router.post('/', protect, requireRole('student'), async (req, res) => {
  try {
    const { title, category, description, priority, mediaUrl, isSOS } = req.body;
    if (!title || !category || !description)
      return res.status(400).json({ success: false, message: 'Title, category, and description are required.' });

    if (!isSOS) {
      const openCount = await Complaint.countDocuments({ studentId: req.user._id, status: { $in: ['open','inprogress'] } });
      if (openCount >= 5)
        return res.status(400).json({ success: false, message: 'You have 5 open complaints. Wait for them to resolve first.' });
    }

    const ROUTING = Complaint.CATEGORY_ROUTING;
    const routedTo = ROUTING[category] || 'campus_admin';
    const finalPriority = isSOS ? 'SOS' : (priority || 'Medium');

    const complaint = await Complaint.create({
      studentId: req.user._id,
      studentName: req.user.name,
      studentUserId: req.user.userId,
      title, category, description,
      priority: finalPriority,
      routedTo,
      mediaUrl: mediaUrl || '',
      isSOS: !!isSOS,
    });

    // Notify the assigned admin
    await notifyAdmins(
      routedTo,
      isSOS ? `🚨 SOS EMERGENCY from ${req.user.name}` : `New Complaint: ${title}`,
      isSOS ? `EMERGENCY! ${req.user.name} (${req.user.userId}) needs immediate help: ${description.substring(0, 100)}` : `Category: ${category} | ${description.substring(0, 100)}`,
      isSOS ? 'sos' : 'complaint',
      complaint._id,
      isSOS ? 'critical' : 'medium'
    );

    if (isSOS) {
      // Also notify all admins for SOS
      await notifyAllAdmins(
        `🚨 SOS EMERGENCY - ${req.user.name}`,
        `Student ${req.user.name} (${req.user.userId}) sent an SOS alert!`,
        'sos', complaint._id, 'critical'
      );
    }

    res.status(201).json({ success: true, message: `Complaint submitted.`, complaint });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST upvote ──────────────────────────────────────────────────────
router.post('/:id/upvote', protect, requireRole('student'), async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Not found.' });

    const alreadyVoted = complaint.upvotedBy.includes(req.user._id);
    if (alreadyVoted) {
      complaint.upvotedBy.pull(req.user._id);
      complaint.upvotes = Math.max(0, complaint.upvotes - 1);
    } else {
      complaint.upvotedBy.push(req.user._id);
      complaint.upvotes += 1;
      // Auto-escalate priority if many upvotes
      if (complaint.upvotes >= 10 && complaint.priority === 'Medium') {
        complaint.priority = 'High';
      }
    }
    await complaint.save();
    res.json({ success: true, upvotes: complaint.upvotes, voted: !alreadyVoted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PATCH update status (admin) ─────────────────────────────────────
router.patch('/:id', protect, async (req, res) => {
  try {
    if (!ADMIN_ROLES.includes(req.user.role))
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found.' });

    if (complaint.routedTo !== req.user.role)
      return res.status(403).json({ success: false, message: 'This complaint is not assigned to your department.' });

    const { status, adminRemarks } = req.body;
    const update = { status, adminRemarks };
    if (status === 'resolved') update.resolvedAt = new Date();

    const updated = await Complaint.findByIdAndUpdate(req.params.id, update, { new: true });

    // Notify student
    await createNotification(
      complaint.studentId,
      `Complaint ${status === 'resolved' ? 'Resolved ✅' : 'Updated'}`,
      `Your complaint "${complaint.title}" status changed to: ${status}. ${adminRemarks ? 'Remarks: ' + adminRemarks : ''}`,
      'complaint', complaint._id, status === 'resolved' ? 'medium' : 'low'
    );

    res.json({ success: true, message: 'Complaint updated!', complaint: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET routing info ─────────────────────────────────────────────────
router.get('/routing-info', (req, res) => {
  res.json({
    success: true,
    routing: {
      academic_admin: ['Academic','Timetable','Faculty'],
      hostel_admin:   ['Hostel','Food','Water','Security'],
      campus_admin:   ['Electricity','Cleanliness','Facilities','Transport','Internet','Other'],
    }
  });
});

module.exports = router;