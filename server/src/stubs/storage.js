/**
 * ─── STUB: Cloud Storage Integration ──────────────────────────────────────────
 *
 * uploadPhoto
 *   Option A — Cloudinary:
 *     const cloudinary = require('cloudinary').v2;
 *     cloudinary.config({ cloudinary_url: process.env.CLOUDINARY_URL });
 *     const result = await cloudinary.uploader.upload(file.path, { folder: 'rebuilt/checkins' });
 *     return { url: result.secure_url, publicId: result.public_id };
 *
 *   Option B — AWS S3:
 *     const s3 = new AWS.S3({ accessKeyId, secretAccessKey });
 *     s3.upload({ Bucket: S3_BUCKET, Key: `checkins/${Date.now()}`, Body: fs.readFileSync(file.path) }).promise()
 *     return { url: `https://${S3_BUCKET}.s3.amazonaws.com/${Key}` }
 *
 * Env vars needed: CLOUDINARY_URL  (or AWS credentials + S3_BUCKET)
 */

const uploadPhoto = async (file) => {
  // STUB — returns a placeholder URL, replace with Cloudinary or S3
  console.log(`[STUB storage.js] uploadPhoto → file: ${file?.originalname || 'unknown'}`);
  return {
    url: '/mock-photos/setup-booth.jpg',
    publicId: `mock-${Date.now()}`,
    mock: true,
  };
};

module.exports = { uploadPhoto };
