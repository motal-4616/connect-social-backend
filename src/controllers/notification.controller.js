const prisma = require('../lib/prisma');

// GET /api/notifications
async function getNotifications(req, res, next) {
  try {
    const { cursor, limit = 20 } = req.query;
    const take = Math.min(parseInt(limit), 50);

    const notifications = await prisma.notification.findMany({
      where: { receiverId: req.user.id },
      take,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
      include: {
        triggerer: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    const unreadCount = await prisma.notification.count({
      where: { receiverId: req.user.id, isRead: false },
    });

    res.json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
}

// PUT /api/notifications/read-all
async function markAllRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { receiverId: req.user.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
}

// PUT /api/notifications/:id/read
async function markRead(req, res, next) {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });

    if (!notification || notification.receiverId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getNotifications, markAllRead, markRead };
