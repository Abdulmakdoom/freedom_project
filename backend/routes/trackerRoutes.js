const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getTracker, resetTracker, toggleDay } = require('../controllers/trackerController');

const router = express.Router();

router.get('/', authMiddleware, getTracker);
router.patch('/day/:day', authMiddleware, toggleDay);
router.post('/reset', authMiddleware, resetTracker);

module.exports = router;
