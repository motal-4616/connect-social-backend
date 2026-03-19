const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { auth } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/story.controller');

router.get('/', auth, ctrl.getStories);
router.post(
  '/',
  auth,
  [body('imageUrl').notEmpty().isURL(), validate],
  ctrl.createStory
);

module.exports = router;
