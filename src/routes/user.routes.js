const router = require('express').Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { auth } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/user.controller');

router.get('/:id', auth, ctrl.getUser);

router.put(
  '/profile',
  auth,
  [
    body('username')
      .optional()
      .trim()
      .isLength({ min: 3 })
      .matches(/^[a-zA-Z0-9_]+$/),
    body('fullName').optional().trim().notEmpty(),
    body('bio').optional().isLength({ max: 300 }),
    validate,
  ],
  ctrl.updateProfile
);

router.put(
  '/password',
  auth,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
    validate,
  ],
  ctrl.changePassword
);

module.exports = router;
