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

/**
 * Validates a base64 data-URI image before it's ever sent to Cloudinary or
 * stored. The naive `str.startsWith('data:image')` check used to be the only
 * gate — that matches any string starting with those 10 characters,
 * including non-image subtypes, and does nothing to cap payload size before
 * it lands in a database document. This checks the actual declared MIME
 * subtype against an allowlist and estimates decoded size from the base64
 * length (each base64 char ≈ 0.75 bytes).
 *
 * Returns { ok: true } or { ok: false, message } — never throws, so callers
 * can safely check `.ok` without a try/catch.
 */
const ALLOWED_IMAGE_TYPES = ['jpeg', 'jpg', 'png', 'webp', 'gif'];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB decoded

function validateImageDataUri(value) {
  if (value === undefined || value === null || value === '') return { ok: true }; // clearing/empty is always fine
  if (typeof value !== 'string') return { ok: false, message: 'Photo must be a valid image.' };
  if (!value.startsWith('data:image')) return { ok: true }; // already a URL (e.g. Cloudinary) — nothing to validate here

  const match = value.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return { ok: false, message: 'Invalid image format.' };
  const [, subtype, base64Data] = match;
  if (!ALLOWED_IMAGE_TYPES.includes(subtype.toLowerCase()))
    return { ok: false, message: `Unsupported image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}.` };

  const approxBytes = base64Data.length * 0.75;
  if (approxBytes > MAX_IMAGE_BYTES)
    return { ok: false, message: `Image too large — max ${(MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0)}MB.` };

  return { ok: true };
}

module.exports = { sendError, sendSuccess, sanitizeString, sanitizeBody, validateImageDataUri };
