// Wraps Cloudinary so profile photos can move out of MongoDB (base64 blobs
// bloat documents and slow down every query that touches a User doc) and
// into real object storage.
//
// Configuration is entirely optional: if CLOUDINARY_URL (or the three
// CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET vars)
// isn't set, isConfigured is false and callers should keep the existing
// base64-in-Mongo behavior — this file never throws just because Cloudinary
// hasn't been set up yet.
const cloudinary = require('cloudinary').v2;

const isConfigured = Boolean(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

if (isConfigured && !process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}
// If CLOUDINARY_URL is set, the SDK picks it up automatically — no explicit
// config() call needed in that case.

/**
 * Uploads a base64 data-URI image to Cloudinary and returns its secure URL.
 * Throws if Cloudinary isn't configured or the upload fails — callers should
 * check isConfigured first and catch errors to fall back to storing the
 * base64 string directly, so a Cloudinary outage never blocks a profile
 * update.
 */
/**
 * Uploads a base64 data-URI image to Cloudinary and returns its secure URL.
 * Throws if Cloudinary isn't configured or the upload fails — callers should
 * check isConfigured first and catch errors to fall back to storing the
 * base64 string directly, so a Cloudinary outage never blocks a save.
 */
async function uploadImage(base64DataUri, publicId, folder = 'poornima-s-care/uploads') {
  const result = await cloudinary.uploader.upload(base64DataUri, {
    folder,
    public_id: String(publicId),
    overwrite: true,
    resource_type: 'image',
    // Keep uploads reasonably small.
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
  });
  return result.secure_url;
}

// Backwards-compatible name used by existing profile-photo callers.
function uploadProfilePhoto(base64DataUri, userId) {
  return uploadImage(base64DataUri, userId, 'poornima-s-care/profile-photos');
}

module.exports = { isConfigured, uploadProfilePhoto, uploadImage };
