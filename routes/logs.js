const express = require('express');
const router = express.Router();
const { getLogsByAsset, createLog, getLogs } = require('../controllers/logController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, admin, getLogs)
    .post(protect, createLog);

router.get('/public/:assetId', getLogsByAsset);

module.exports = router;
