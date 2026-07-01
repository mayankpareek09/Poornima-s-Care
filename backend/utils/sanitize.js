// Escapes user-supplied search input before it's used inside a MongoDB $regex query.
// Prevents NoSQL regex-DoS (catastrophic backtracking) and 500s from special characters
// like ( ) . * + ? in legitimate search terms (e.g. names with periods or parentheses).
function escapeRegex(input) {
  if (typeof input !== 'string') return '';
  // Cap length — overly long search strings are themselves a cheap DoS vector
  const trimmed = input.slice(0, 100);
  return trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
