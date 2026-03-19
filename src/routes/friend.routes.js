const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { auth } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/friend.controller');

router.get('/', auth, ctrl.getFriends);
router.get('/requests', auth, ctrl.getRequests);
router.post('/request/:userId', auth, ctrl.sendRequest);
router.put(
  '/respond/:friendshipId',
  auth,
  [body('action').isIn(['accept', 'reject']), validate],
  ctrl.respondRequest
);
router.delete('/:userId', auth, ctrl.removeFriend);

module.exports = router;
