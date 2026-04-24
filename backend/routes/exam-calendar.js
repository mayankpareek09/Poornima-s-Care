const express = require('express');
const router  = express.Router();
const ExamCalendar = require('../models/ExamCalendar');
const { protect, requireRole } = require('../middleware/auth');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const adminOnly = [protect, requireRole('academic_admin')];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  META — distinct lists (for dropdowns)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/exam-calendar/meta  → { departments, years, examTypes }
router.get('/meta', async (req, res) => {
  try {
    const docs = await ExamCalendar.find({}, 'department year examType');
    const departments = [...new Set(docs.map(d => d.department))].sort();
    const years       = [...new Set(docs.map(d => d.year))].sort();
    const examTypes   = [...new Set(docs.map(d => d.examType))].sort();
    res.json({ success: true, departments, years, examTypes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LIST / FILTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// GET /api/exam-calendar?department=&year=&examType=
router.get('/', async (req, res) => {
  try {
    const q = {};
    if (req.query.department) q.department = req.query.department;
    if (req.query.year)       q.year       = req.query.year;
    if (req.query.examType)   q.examType   = req.query.examType;
    const calendars = await ExamCalendar.find(q).sort({ department: 1, year: 1, examType: 1 });
    res.json({ success: true, calendars });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/exam-calendar/:id
router.get('/:id', async (req, res) => {
  try {
    const cal = await ExamCalendar.findById(req.params.id);
    if (!cal) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, calendar: cal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CREATE — new calendar document
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/exam-calendar
router.post('/', ...adminOnly, async (req, res) => {
  try {
    const { department, year, examType } = req.body;
    if (!department || !year || !examType)
      return res.status(400).json({ success: false, message: 'department, year and examType are required.' });

    const exists = await ExamCalendar.findOne({ department, year, examType });
    if (exists)
      return res.status(400).json({ success: false, message: 'A calendar for this combination already exists.' });

    const cal = await ExamCalendar.create({ department, year, examType, subjects: [], schedule: [], updatedBy: req.user.name });
    res.status(201).json({ success: true, message: 'Exam calendar created!', calendar: cal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  UPDATE header fields (department / year / examType)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// PUT /api/exam-calendar/:id
router.put('/:id', ...adminOnly, async (req, res) => {
  try {
    const { department, year, examType } = req.body;
    const cal = await ExamCalendar.findByIdAndUpdate(
      req.params.id,
      { department, year, examType, updatedBy: req.user.name },
      { new: true }
    );
    if (!cal) return res.status(404).json({ success: false, message: 'Calendar not found.' });
    res.json({ success: true, message: 'Calendar updated!', calendar: cal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/exam-calendar/:id
router.delete('/:id', ...adminOnly, async (req, res) => {
  try {
    await ExamCalendar.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Calendar deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SUBJECTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/exam-calendar/:id/subjects
router.post('/:id/subjects', ...adminOnly, async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: 'Subject name and code required.' });
    const cal = await ExamCalendar.findById(req.params.id);
    if (!cal) return res.status(404).json({ success: false, message: 'Calendar not found.' });
    cal.subjects.push({ name, code });
    cal.updatedBy = req.user.name;
    await cal.save();
    res.json({ success: true, message: 'Subject added!', calendar: cal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/exam-calendar/:id/subjects/:subId
router.put('/:id/subjects/:subId', ...adminOnly, async (req, res) => {
  try {
    const { name, code } = req.body;
    const cal = await ExamCalendar.findById(req.params.id);
    if (!cal) return res.status(404).json({ success: false, message: 'Calendar not found.' });
    const sub = cal.subjects.id(req.params.subId);
    if (!sub) return res.status(404).json({ success: false, message: 'Subject not found.' });
    if (name) sub.name = name;
    if (code) sub.code = code;
    // update references in schedule
    cal.schedule.forEach(s => {
      if (String(s.subjectId) === req.params.subId) {
        s.subjectName = sub.name;
        s.subjectCode = sub.code;
      }
    });
    cal.updatedBy = req.user.name;
    await cal.save();
    res.json({ success: true, message: 'Subject updated!', calendar: cal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/exam-calendar/:id/subjects/:subId
router.delete('/:id/subjects/:subId', ...adminOnly, async (req, res) => {
  try {
    const cal = await ExamCalendar.findById(req.params.id);
    if (!cal) return res.status(404).json({ success: false, message: 'Calendar not found.' });
    cal.subjects.pull(req.params.subId);
    // remove orphan schedule entries
    cal.schedule = cal.schedule.filter(s => String(s.subjectId) !== req.params.subId);
    cal.updatedBy = req.user.name;
    await cal.save();
    res.json({ success: true, message: 'Subject deleted.', calendar: cal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SCHEDULE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// POST /api/exam-calendar/:id/schedule
router.post('/:id/schedule', ...adminOnly, async (req, res) => {
  try {
    const { subjectId, date, time, room } = req.body;
    if (!date || !time) return res.status(400).json({ success: false, message: 'date and time are required.' });
    const cal = await ExamCalendar.findById(req.params.id);
    if (!cal) return res.status(404).json({ success: false, message: 'Calendar not found.' });
    let subjectName = '', subjectCode = '';
    if (subjectId) {
      const sub = cal.subjects.id(subjectId);
      if (sub) { subjectName = sub.name; subjectCode = sub.code; }
    }
    cal.schedule.push({ subjectId, subjectName, subjectCode, date, time, room: room || '' });
    cal.updatedBy = req.user.name;
    await cal.save();
    res.json({ success: true, message: 'Schedule entry added!', calendar: cal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/exam-calendar/:id/schedule/:schId
router.put('/:id/schedule/:schId', ...adminOnly, async (req, res) => {
  try {
    const { subjectId, date, time, room } = req.body;
    const cal = await ExamCalendar.findById(req.params.id);
    if (!cal) return res.status(404).json({ success: false, message: 'Calendar not found.' });
    const entry = cal.schedule.id(req.params.schId);
    if (!entry) return res.status(404).json({ success: false, message: 'Schedule entry not found.' });
    if (subjectId) {
      const sub = cal.subjects.id(subjectId);
      entry.subjectId   = subjectId;
      entry.subjectName = sub ? sub.name : '';
      entry.subjectCode = sub ? sub.code : '';
    }
    if (date) entry.date = date;
    if (time) entry.time = time;
    if (room !== undefined) entry.room = room;
    cal.updatedBy = req.user.name;
    await cal.save();
    res.json({ success: true, message: 'Schedule updated!', calendar: cal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/exam-calendar/:id/schedule/:schId
router.delete('/:id/schedule/:schId', ...adminOnly, async (req, res) => {
  try {
    const cal = await ExamCalendar.findById(req.params.id);
    if (!cal) return res.status(404).json({ success: false, message: 'Calendar not found.' });
    cal.schedule.pull(req.params.schId);
    cal.updatedBy = req.user.name;
    await cal.save();
    res.json({ success: true, message: 'Schedule entry deleted.', calendar: cal });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;