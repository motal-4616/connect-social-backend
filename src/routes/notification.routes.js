const router = require('express').Router();
const { auth } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/notification.controller');

router.get('/', auth, ctrl.getNotifications);
router.put('/read-all', auth, ctrl.markAllRead);
router.put('/:id/read', auth, ctrl.markRead);

module.exports = router;
