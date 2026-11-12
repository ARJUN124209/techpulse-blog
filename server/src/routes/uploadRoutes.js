import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'node:stream';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dir = path.dirname(fileURLToPath(import.meta.url));
const uploads = path.join(__dir, '../../uploads');
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const cloudinarySettings = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};
const configuredValues = Object.values(cloudinarySettings);
const cloudinaryConfigured = configuredValues.every(Boolean);
const cloudinaryPartiallyConfigured = configuredValues.some(Boolean) && !cloudinaryConfigured;

if (cloudinaryConfigured) cloudinary.config({ ...cloudinarySettings, secure: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => extensions[file.mimetype]
    ? cb(null, true)
    : cb(new Error('Only JPG, PNG, WebP or GIF images are allowed'))
});

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'techpulse_blog', public_id: crypto.randomBytes(12).toString('hex'), resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url) return reject(new Error('Cloudinary returned no image URL'));
        resolve(result.secure_url);
      }
    );
    Readable.from([buffer]).pipe(stream);
  });
}

async function saveLocally(file) {
  const filename = crypto.randomBytes(12).toString('hex') + extensions[file.mimetype];
  await fs.promises.mkdir(uploads, { recursive: true });
  await fs.promises.writeFile(path.join(uploads, filename), file.buffer);
  return `/uploads/${filename}`;
}

router.post(
  '/',
  (req, res, next) => {
    if (cloudinaryPartiallyConfigured) return res.status(503).json({ error: 'Cloudinary configuration is incomplete' });
    if (!cloudinaryConfigured && process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Cloudinary image uploads are not configured' });
    }
    next();
  },
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
  async (req, res, next) => {
    const file = req.files?.image?.[0] || req.files?.file?.[0];
    if (!file) return res.status(400).json({ message: 'No image provided' });

    try {
      const url = cloudinaryConfigured
        ? await uploadToCloudinary(file.buffer)
        : await saveLocally(file);
      res.status(200).json({ url });
    } catch (error) {
      if (cloudinaryConfigured) return res.status(502).json({ error: 'Cloudinary image upload failed' });
      next(error);
    }
  }
);

export default router;
