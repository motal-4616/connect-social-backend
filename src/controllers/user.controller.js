const prisma = require('../lib/prisma');

// GET /api/users/:id
async function getUser(req, res, next) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, fullName: true, username: true, bio: true, avatarUrl: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            sentRequests: { where: { status: 'ACCEPTED' } },
            receivedRequests: { where: { status: 'ACCEPTED' } },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate followers/following
    const followersCount = user._count.receivedRequests;
    const followingCount = user._count.sentRequests;

    res.json({
      ...user,
      followersCount,
      followingCount,
      postsCount: user._count.posts,
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/users/profile
async function updateProfile(req, res, next) {
  try {
    const { fullName, username, bio, avatarUrl } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(fullName && { fullName }),
        ...(username && { username }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      select: {
        id: true, fullName: true, username: true, bio: true, avatarUrl: true, email: true,
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
}

// PUT /api/users/password
async function changePassword(req, res, next) {
  try {
    const bcrypt = require('bcryptjs');
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getUser, updateProfile, changePassword };
