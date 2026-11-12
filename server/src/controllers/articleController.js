import Article from '../models/Article.js';

export const createArticle = async (req, res) => {
  try {
    const article = new Article(req.body);
    const savedArticle = await article.save();
    res.status(201).json(savedArticle);
  } catch (error) {
    res.status(400).json({ message: 'Failed to create article', error: error.message });
  }
};

export const getArticles = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const articles = await Article.find(filter)
      .populate('category')
      .sort({ createdAt: -1 });

    res.status(200).json(articles);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch articles', error: error.message });
  }
};