const mongoose = require('mongoose');

// Generic atomic counter, keyed by string (e.g. "canteen-20260716").
// findOneAndUpdate with $inc is a single atomic MongoDB operation, so concurrent
// requests can never receive the same sequence number — unlike countDocuments(),
// which reads a snapshot that can go stale between the read and the insert.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

async function nextSequence(key) {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

module.exports = { Counter, nextSequence };
