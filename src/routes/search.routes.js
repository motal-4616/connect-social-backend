const router = require('express').Router();
const { auth } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/search.controller');

router.get('/', auth, ctrl.search);

module.exports = router;
