const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { auth } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/post.controller');

router.get('/', auth, ctrl.getFeed);
router.post(
  '/',
  auth,
  [body('content').trim().notEmpty().isLength({ max: 2000 }), validate],
  ctrl.createPost
);

router.get('/user/:userId', auth, ctrl.getUserPosts);
router.get('/:id', auth, ctrl.getPost);
router.delete('/:id', auth, ctrl.deletePost);

router.post('/:id/like', auth, ctrl.toggleLike);
router.post(
  '/:id/comments',
  auth,
  [body('content').trim().notEmpty().isLength({ max: 1000 }), validate],
  ctrl.addComment
);

module.exports = router;
