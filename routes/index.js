const router = require('express').Router();
const getUserInfo = require('../controllers/user/getUserInfo');

router.get('/user', getUserInfo);

module.exports = router;