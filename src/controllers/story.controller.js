const prisma = require('../lib/prisma');

// POST /api/stories
async function createStory(req, res, next) {
  try {
    const { imageUrl } = req.body;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const story = await prisma.story.create({
      data: { imageUrl, userId: req.user.id, expiresAt },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    res.status(201).json(story);
  } catch (error) {
    next(error);
  }
}

// GET /api/stories
async function getStories(req, res, next) {
  try {
    // Get friends' stories (not expired)
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: req.user.id }, { receiverId: req.user.id }],
      },
      select: { senderId: true, receiverId: true },
    });

    const friendIds = friendships.map((f) =>
      f.senderId === req.user.id ? f.receiverId : f.senderId
    );
    friendIds.push(req.user.id);

    const stories = await prisma.story.findMany({
      where: {
        userId: { in: friendIds },
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Group stories by user
    const grouped = {};
    for (const story of stories) {
      if (!grouped[story.userId]) {
        grouped[story.userId] = {
          user: story.user,
          stories: [],
        };
      }
      grouped[story.userId].stories.push(story);
    }

    res.json(Object.values(grouped));
  } catch (error) {
    next(error);
  }
}

module.exports = { createStory, getStories };
