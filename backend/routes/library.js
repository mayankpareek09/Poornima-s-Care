const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const BookIssue = require('../models/BookIssue');
const User = require('../models/User');
const { protect, requireRole } = require('../middleware/auth');
const { sanitizeString } = require('../utils/apiHelpers');
const { createNotification } = require('../utils/notificationHelper');

const FINE_PER_DAY = 2;       // ₹2/day overdue
const ISSUE_DAYS = 14;        // 2-week loan period
const MAX_BOOKS_PER_STUDENT = 3;

function computeFine(dueDate, returnDate) {
  const due = new Date(dueDate), ret = new Date(returnDate);
  if (ret <= due) return 0;
  const daysLate = Math.ceil((ret - due) / (1000 * 60 * 60 * 24));
  return daysLate * FINE_PER_DAY;
}

// GET /api/library/books — browse catalog (any logged-in user)
router.get('/books', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.q) filter.$text = { $search: req.query.q };
    const books = await Book.find(filter).sort({ title: 1 }).limit(300);
    res.json({ success: true, books });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// GET /api/library/my — student's current + past issued books
router.get('/my', protect, requireRole('student'), async (req, res) => {
  try {
    const issues = await BookIssue.find({ studentId: req.user._id }).populate('bookId', 'title author').sort({ createdAt: -1 });
    const now = new Date();
    const withFine = issues.map(i => {
      const obj = i.toObject();
      if (i.status === 'issued' && now > i.dueDate) obj.currentFine = computeFine(i.dueDate, now);
      return obj;
    });
    res.json({ success: true, issues: withFine, activeCount: issues.filter(i => i.status === 'issued').length, maxBooks: MAX_BOOKS_PER_STUDENT });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// ---- Library admin management ----

router.post('/books', protect, requireRole('library_admin'), async (req, res) => {
  try {
    const { title, author, isbn, category, publisher, edition, totalCopies, coverColor } = req.body;
    if (!title || !title.trim() || !author || !author.trim())
      return res.status(400).json({ success: false, message: 'Title and author are required.' });
    const copies = Math.max(1, parseInt(totalCopies) || 1);
    const book = await Book.create({
      title: sanitizeString(title), author: sanitizeString(author), isbn: sanitizeString(isbn || ''),
      category: category || 'Other', publisher: sanitizeString(publisher || ''), edition: sanitizeString(edition || ''),
      totalCopies: copies, availableCopies: copies, coverColor: coverColor || '#0B2E33', addedBy: req.user._id,
    });
    res.status(201).json({ success: true, message: 'Book added to catalog.', book });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

router.patch('/books/:id', protect, requireRole('library_admin'), async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ success: false, message: 'Book not found.' });
    const { title, author, isbn, category, publisher, edition, totalCopies, coverColor } = req.body;
    const oldTotal = book.totalCopies;
    if (title) book.title = sanitizeString(title);
    if (author) book.author = sanitizeString(author);
    if (isbn !== undefined) book.isbn = sanitizeString(isbn);
    if (category) book.category = category;
    if (publisher !== undefined) book.publisher = sanitizeString(publisher);
    if (edition !== undefined) book.edition = sanitizeString(edition);
    if (coverColor) book.coverColor = coverColor;
    if (totalCopies !== undefined) {
      const newTotal = Math.max(0, parseInt(totalCopies) || 0);
      book.availableCopies = Math.max(0, book.availableCopies + (newTotal - oldTotal));
      book.totalCopies = newTotal;
    }
    await book.save();
    res.json({ success: true, message: 'Book updated.', book });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

router.delete('/books/:id', protect, requireRole('library_admin'), async (req, res) => {
  try {
    const active = await BookIssue.countDocuments({ bookId: req.params.id, status: 'issued' });
    if (active > 0) return res.status(400).json({ success: false, message: 'Cannot delete — copies are currently issued.' });
    await Book.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Book removed from catalog.' });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// GET /api/library/issues — all active + overdue issues (library admin)
router.get('/issues', protect, requireRole('library_admin'), async (req, res) => {
  try {
    const filter = req.query.status ? { status: req.query.status } : {};
    const issues = await BookIssue.find(filter).sort({ dueDate: 1 });
    const now = new Date();
    const withFine = issues.map(i => {
      const obj = i.toObject();
      if (i.status === 'issued' && now > i.dueDate) obj.currentFine = computeFine(i.dueDate, now);
      obj.isOverdue = i.status === 'issued' && now > i.dueDate;
      return obj;
    });
    res.json({ success: true, issues: withFine });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// POST /api/library/issue — library admin issues a book to a student (looked up by userId)
router.post('/issue', protect, requireRole('library_admin'), async (req, res) => {
  try {
    const { bookId, studentUserId } = req.body;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ success: false, message: 'Book not found.' });
    if (book.availableCopies < 1) return res.status(400).json({ success: false, message: 'No copies available right now.' });

    const student = await User.findOne({ userId: studentUserId, role: 'student' });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found with that ID.' });

    const activeCount = await BookIssue.countDocuments({ studentId: student._id, status: 'issued' });
    if (activeCount >= MAX_BOOKS_PER_STUDENT)
      return res.status(400).json({ success: false, message: `Student already has ${MAX_BOOKS_PER_STUDENT} books issued (max limit).` });

    const alreadyHas = await BookIssue.findOne({ studentId: student._id, bookId: book._id, status: 'issued' });
    if (alreadyHas) return res.status(400).json({ success: false, message: 'Student already has this exact book issued.' });

    const dueDate = new Date(Date.now() + ISSUE_DAYS * 24 * 60 * 60 * 1000);
    const issue = await BookIssue.create({
      bookId: book._id, bookTitle: book.title, studentId: student._id, studentName: student.name,
      studentUserId: student.userId, dueDate, issuedBy: req.user._id,
    });
    book.availableCopies -= 1;
    await book.save();

    createNotification(student._id, 'Library', `"${book.title}" issued to you. Due back by ${dueDate.toLocaleDateString('en-IN')}.`, 'system', issue._id, 'low');
    res.status(201).json({ success: true, message: `Issued to ${student.name}. Due ${dueDate.toLocaleDateString('en-IN')}.`, issue });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

// PATCH /api/library/return/:issueId — mark returned, compute fine
router.patch('/return/:issueId', protect, requireRole('library_admin'), async (req, res) => {
  try {
    const issue = await BookIssue.findById(req.params.issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue record not found.' });
    if (issue.status === 'returned') return res.status(400).json({ success: false, message: 'Already returned.' });

    const now = new Date();
    const fine = computeFine(issue.dueDate, now);
    issue.status = 'returned';
    issue.returnedAt = now;
    issue.fineAmount = fine;
    await issue.save();

    const book = await Book.findById(issue.bookId);
    if (book) { book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1); await book.save(); }

    createNotification(issue.studentId, 'Library', `"${issue.bookTitle}" returned.${fine > 0 ? ' Fine: ₹' + fine + ' (overdue).' : ' Thanks!'}`, 'system', issue._id, fine > 0 ? 'medium' : 'low');
    res.json({ success: true, message: fine > 0 ? `Returned. Fine: ₹${fine}` : 'Returned — no fine.', issue, fine });
  } catch (err) { res.status(500).json({ success: false, message: process.env.NODE_ENV==="production" ? "Server error. Please try again." : err.message }); }
});

module.exports = router;
