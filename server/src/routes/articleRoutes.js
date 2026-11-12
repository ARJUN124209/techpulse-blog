import express from 'express';
import { createArticle, getArticles } from '../controllers/articleController.js';

const router = express.Router();

// GET /api/articles - Fetch all articles
router.get('/', getArticles);
// POST /api/articles - Create a new article
router.post('/', createArticle);

export default router;