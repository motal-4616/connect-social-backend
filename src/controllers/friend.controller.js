const prisma = require('../lib/prisma');
const pusher = require('../lib/pusher');

// POST /api/friends/request/:userId
async function sendRequest(req, res, next) {
  try {
    const receiverId = req.params.userId;
    const senderId = req.user.id;

    if (senderId === receiverId) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }

    // Check if request already exists (either direction)
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'Friend request already exists', status: existing.status });
    }

    const friendship = await prisma.friendship.create({
      data: { senderId, receiverId },
    });

    // Notify receiver
    await prisma.notification.create({
      data: { type: 'FRIEND_REQUEST', receiverId, triggererId: senderId },
    });

    pusher.trigger(`user-${receiverId}`, 'notification', {
      type: 'FRIEND_REQUEST',
      triggerer: req.user,
    });

    res.status(201).json(friendship);
  } catch (error) {
    next(error);
  }
}

// PUT /api/friends/respond/:friendshipId
async function respondRequest(req, res, next) {
  try {
    const { friendshipId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'

    const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });

    if (!friendship || friendship.receiverId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (friendship.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request already handled' });
    }

    const status = action === 'accept' ? 'ACCEPTED' : 'REJECTED';

    const updated = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status },
    });

    if (action === 'accept') {
      pusher.trigger(`user-${friendship.senderId}`, 'notification', {
        type: 'FRIEND_ACCEPTED',
        triggerer: req.user,
      });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

// GET /api/friends
async function getFriends(req, res, next) {
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: req.user.id }, { receiverId: req.user.id }],
      },
      include: {
        sender: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        receiver: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    const friends = friendships.map((f) =>
      f.senderId === req.user.id ? f.receiver : f.sender
    );

    res.json(friends);
  } catch (error) {
    next(error);
  }
}

// GET /api/friends/requests
async function getRequests(req, res, next) {
  try {
    const requests = await prisma.friendship.findMany({
      where: { receiverId: req.user.id, status: 'PENDING' },
      include: {
        sender: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/friends/:userId
async function removeFriend(req, res, next) {
  try {
    const userId = req.params.userId;

    await prisma.friendship.deleteMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: req.user.id, receiverId: userId },
          { senderId: userId, receiverId: req.user.id },
        ],
      },
    });

    res.json({ message: 'Friend removed' });
  } catch (error) {
    next(error);
  }
}

module.exports = { sendRequest, respondRequest, getFriends, getRequests, removeFriend };
