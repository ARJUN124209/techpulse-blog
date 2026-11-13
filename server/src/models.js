import mongoose from 'mongoose';
const { Schema, model } = mongoose;
export const slugify = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
export const User = model('User', new Schema({
  name: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false }, role: { type: String, enum: ['admin', 'editor'], default: 'editor' }
}));
export const Category = model('Category', new Schema({ name: { type: String, required: true, unique: true }, slug: { type: String, required: true, unique: true } }));
export const Post = model('Post', new Schema({
  title: { type: String, required: true }, slug: { type: String, required: true, unique: true }, excerpt: { type: String, default: '' },
  content: { type: String, default: '' }, image: String, readingTime: { type: Number, min: 1 }, category: { type: Schema.Types.ObjectId, ref: 'Category' }, tags: [String],
  author: { type: Schema.Types.ObjectId, ref: 'User' }, authorName: { type: String, default: 'Editorial Team' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  publishAt: { type: Date, default: Date.now }, featured: { type: Boolean, default: false }, views: { type: Number, default: 0 },
  seoTitle: String, seoDescription: String
}, { timestamps: true }));
