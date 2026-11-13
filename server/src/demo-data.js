export const demoCategories = [
  { _id: 'demo-category-ai', name: 'Artificial Intelligence & Machine Learning', slug: 'artificial-intelligence-machine-learning' },
  { _id: 'demo-category-cloud', name: 'Cloud Computing', slug: 'cloud-computing' },
  { _id: 'demo-category-software', name: 'Software Development', slug: 'software-development' }
];

export const demoPosts = [
  {
    _id: 'demo-post-1',
    title: 'A practical guide to reliable AI features',
    slug: 'reliable-ai-features',
    excerpt: 'Design an AI workflow that is observable, grounded, and ready for real users.',
    category: demoCategories[0],
    tags: ['AI', 'Engineering'],
    status: 'published',
    publishAt: '2026-10-28T09:00:00.000Z',
    featured: true,
    views: 842,
    authorName: 'Demo Editorial Team'
  },
  {
    _id: 'demo-post-2',
    title: 'Making cloud deployments easier to operate',
    slug: 'operable-cloud-deployments',
    excerpt: 'A small set of delivery practices can improve visibility without adding process overhead.',
    category: demoCategories[1],
    tags: ['Cloud', 'DevOps'],
    status: 'published',
    publishAt: '2026-10-19T09:00:00.000Z',
    featured: false,
    views: 516,
    authorName: 'Demo Editorial Team'
  },
  {
    _id: 'demo-post-3',
    title: 'Build APIs that are easier to change',
    slug: 'apis-easier-to-change',
    excerpt: 'Clear boundaries and compatibility checks help teams evolve services safely.',
    category: demoCategories[2],
    tags: ['APIs', 'Architecture'],
    status: 'published',
    publishAt: '2026-10-11T09:00:00.000Z',
    featured: true,
    views: 391,
    authorName: 'Demo Editorial Team'
  }
];
