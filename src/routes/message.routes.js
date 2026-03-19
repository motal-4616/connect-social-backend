const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { auth } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/message.controller');

router.get('/conversations', auth, ctrl.getConversations);
router.get('/:userId', auth, ctrl.getMessages);
router.post(
  '/:userId',
  auth,
  [body('content').trim().notEmpty().isLength({ max: 2000 }), validate],
  ctrl.sendMessage
);
router.post('/pusher/auth', auth, ctrl.pusherAuth);

module.exports = router;
