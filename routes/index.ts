const router = require('express').Router();

const {
    getUserInfo,
    createUser,
} = require('../controllers/user');

router.get('/user', getUserInfo);
router.post('/user', createUser);


module.exports = router;
