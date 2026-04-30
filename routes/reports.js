const express = require('express');
const router = express.Router();
const { getSummary, getAssetsByType } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

router.get('/summary', protect, getSummary);
router.get('/assets-by-type', protect, getAssetsByType);

module.exports = router;
