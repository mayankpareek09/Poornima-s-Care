// Centralized API response helpers and error handling
// Prevents internal error messages from leaking to clients in production

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Send a standardized error response.
 * In production, internal errors show a generic message only.
 * In development, full error message is shown for easier debugging.
 */
function sendError(res, statusCode, message, err = null) {
  if (err) console.error(`[ERROR] ${message}:`, err.message);
  const clientMessage = (statusCode === 500 && IS_PROD)
    ? 'Something went wrong on our end. Please try again.'
    : message;
  return res.status(statusCode).json({ success: false, message: clientMessage });
}

/**
 * Standard success response
 */
function sendSuccess(res, data = {}, statusCode = 200) {
  return res.status(statusCode).json({ success: true, ...data });
}

/**
 * Sanitize a string to prevent stored XSS.
 * Strips HTML tags and trims whitespace.
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '').trim().slice(0, 5000);
}

/**
 * Sanitize an entire request body object recursively.
 * Applies to all string values.
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return body;
  const clean = {};
  for (const [key, val] of Object.entries(body)) {
    if (typeof val === 'string') clean[key] = sanitizeString(val);
    else if (typeof val === 'object' && val !== null) clean[key] = sanitizeBody(val);
    else clean[key] = val;
  }
  return clean;
}

module.exports = { sendError, sendSuccess, sanitizeString, sanitizeBody };
