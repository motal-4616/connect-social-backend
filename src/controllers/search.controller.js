const prisma = require('../lib/prisma');

// GET /api/search?q=keyword
async function search(req, res, next) {
  try {
    const { q, type = 'all' } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const results = {};

    if (type === 'all' || type === 'people') {
      results.users = await prisma.user.findMany({
        where: {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true, fullName: true, username: true, avatarUrl: true, bio: true,
          _count: { select: { receivedRequests: { where: { status: 'ACCEPTED' } } } },
        },
        take: 10,
      });
    }

    if (type === 'all' || type === 'posts') {
      results.posts = await prisma.post.findMany({
        where: { content: { contains: q, mode: 'insensitive' } },
        include: {
          user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    }

    res.json(results);
  } catch (error) {
    next(error);
  }
}

module.exports = { search };
