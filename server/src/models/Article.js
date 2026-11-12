import mongoose from 'mongoose';

const { Schema } = mongoose;

const articleSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  excerpt: { type: String, default: '' },
  content: { type: String, default: '' },
  image: String,
  category: { type: Schema.Types.ObjectId, ref: 'Category' },
  tags: [String],
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  publishAt: { type: Date, default: Date.now },
  featured: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  seoTitle: String,
  seoDescription: String
}, { timestamps: true });

export default mongoose.model('Article', articleSchema);