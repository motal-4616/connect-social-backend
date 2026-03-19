const prisma = require('../lib/prisma');
const pusher = require('../lib/pusher');

// GET /api/messages/conversations
async function getConversations(req, res, next) {
  try {
    const userId = req.user.id;

    // Get latest message per conversation partner
    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        receiver: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
      },
    });

    // Group by partner and get latest message
    const conversationMap = new Map();
    for (const msg of messages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversationMap.has(partnerId)) {
        const partner = msg.senderId === userId ? msg.receiver : msg.sender;
        conversationMap.set(partnerId, {
          partner,
          lastMessage: {
            id: msg.id,
            content: msg.content,
            createdAt: msg.createdAt,
            isRead: msg.isRead,
            isMine: msg.senderId === userId,
          },
        });
      }
    }

    // Count unread per partner
    const unreadCounts = await prisma.message.groupBy({
      by: ['senderId'],
      where: { receiverId: userId, isRead: false },
      _count: true,
    });

    const unreadMap = new Map(unreadCounts.map((u) => [u.senderId, u._count]));

    const conversations = Array.from(conversationMap.entries()).map(([partnerId, conv]) => ({
      ...conv,
      unreadCount: unreadMap.get(partnerId) || 0,
    }));

    res.json(conversations);
  } catch (error) {
    next(error);
  }
}

// GET /api/messages/:userId
async function getMessages(req, res, next) {
  try {
    const partnerId = req.params.userId;
    const { cursor, limit = 30 } = req.query;
    const take = Math.min(parseInt(limit), 50);

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: req.user.id, receiverId: partnerId },
          { senderId: partnerId, receiverId: req.user.id },
        ],
      },
      take,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    // Mark unread as read
    await prisma.message.updateMany({
      where: { senderId: partnerId, receiverId: req.user.id, isRead: false },
      data: { isRead: true },
    });

    res.json({
      messages: messages.reverse(),
      nextCursor: messages.length === take ? messages[0].id : null,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/messages/:userId
async function sendMessage(req, res, next) {
  try {
    const receiverId = req.params.userId;
    const { content, imageUrl } = req.body;

    const message = await prisma.message.create({
      data: {
        content,
        imageUrl,
        senderId: req.user.id,
        receiverId,
      },
      include: {
        sender: { select: { id: true, fullName: true, avatarUrl: true } },
      },
    });

    // Real-time push via Pusher
    const channelName = [req.user.id, receiverId].sort().join('-');
    pusher.trigger(`chat-${channelName}`, 'new-message', message);

    // Also notify receiver
    pusher.trigger(`user-${receiverId}`, 'new-message', {
      sender: req.user,
      content: message.content,
      conversationId: channelName,
    });

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
}

// POST /api/messages/pusher/auth
async function pusherAuth(req, res, next) {
  try {
    const { socket_id, channel_name } = req.body;

    // Verify user has access to the channel
    if (channel_name.startsWith('private-user-')) {
      const channelUserId = channel_name.replace('private-user-', '');
      if (channelUserId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized for this channel' });
      }
    }

    const auth = pusher.authorizeChannel(socket_id, channel_name);
    res.json(auth);
  } catch (error) {
    next(error);
  }
}

module.exports = { getConversations, getMessages, sendMessage, pusherAuth };
