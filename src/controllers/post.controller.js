const prisma = require('../lib/prisma');
const pusher = require('../lib/pusher');

// GET /api/posts  (news feed)
async function getFeed(req, res, next) {
  try {
    const { cursor, limit = 20 } = req.query;
    const take = Math.min(parseInt(limit), 50);

    // Get IDs of friends
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
    friendIds.push(req.user.id); // Include own posts

    const posts = await prisma.post.findMany({
      where: { userId: { in: friendIds } },
      take,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        _count: { select: { comments: true, likes: true } },
        likes: { where: { userId: req.user.id }, select: { id: true } },
      },
    });

    const formatted = posts.map((post) => ({
      ...post,
      isLiked: post.likes.length > 0,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      likes: undefined,
      _count: undefined,
    }));

    res.json({
      posts: formatted,
      nextCursor: posts.length === take ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/posts
async function createPost(req, res, next) {
  try {
    const { content, imageUrl, location } = req.body;

    const post = await prisma.post.create({
      data: { content, imageUrl, location, userId: req.user.id },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
}

// GET /api/posts/:id
async function getPost(req, res, next) {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
            replies: {
              take: 3,
              orderBy: { createdAt: 'asc' },
              include: {
                user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
              },
            },
          },
        },
        _count: { select: { comments: true, likes: true } },
        likes: { where: { userId: req.user.id }, select: { id: true } },
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({
      ...post,
      isLiked: post.likes.length > 0,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      likes: undefined,
      _count: undefined,
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/posts/:id
async function deletePost(req, res, next) {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });

    if (!post || post.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.post.delete({ where: { id: req.params.id } });
    res.json({ message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
}

// POST /api/posts/:id/like
async function toggleLike(req, res, next) {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const existing = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await prisma.like.delete({ where: { id: existing.id } });
      res.json({ liked: false });
    } else {
      await prisma.like.create({ data: { userId, postId } });

      // Notify post owner
      const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
      if (post && post.userId !== userId) {
        await prisma.notification.create({
          data: { type: 'LIKE', receiverId: post.userId, triggererId: userId, postId },
        });
        pusher.trigger(`user-${post.userId}`, 'notification', {
          type: 'LIKE',
          triggerer: req.user,
          postId,
        });
      }

      res.json({ liked: true });
    }
  } catch (error) {
    next(error);
  }
}

// POST /api/posts/:id/comments
async function addComment(req, res, next) {
  try {
    const { content, parentId } = req.body;
    const postId = req.params.id;

    const comment = await prisma.comment.create({
      data: { content, userId: req.user.id, postId, parentId },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    // Notify post owner
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
    if (post && post.userId !== req.user.id) {
      await prisma.notification.create({
        data: { type: 'COMMENT', receiverId: post.userId, triggererId: req.user.id, postId },
      });
      pusher.trigger(`user-${post.userId}`, 'notification', {
        type: 'COMMENT',
        triggerer: req.user,
        postId,
      });
    }

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
}

// GET /api/posts/user/:userId
async function getUserPosts(req, res, next) {
  try {
    const { cursor, limit = 20 } = req.query;
    const take = Math.min(parseInt(limit), 50);

    const posts = await prisma.post.findMany({
      where: { userId: req.params.userId },
      take,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        _count: { select: { comments: true, likes: true } },
        likes: { where: { userId: req.user.id }, select: { id: true } },
      },
    });

    const formatted = posts.map((post) => ({
      ...post,
      isLiked: post.likes.length > 0,
      likesCount: post._count.likes,
      commentsCount: post._count.comments,
      likes: undefined,
      _count: undefined,
    }));

    res.json({
      posts: formatted,
      nextCursor: posts.length === take ? posts[posts.length - 1].id : null,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getFeed, createPost, getPost, deletePost, toggleLike, addComment, getUserPosts };
