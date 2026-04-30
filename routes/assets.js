const express = require('express');
const router = express.Router();
const { 
    getAssets, 
    getAssetById, 
    createAsset, 
    updateAsset, 
    deleteAsset,
    importAssets,
    importExcel,
    downloadTemplate,
    upload,
    uploadImage,
    uploadAssetImage,
    deleteAllAssets
} = require('../controllers/assetController');
const { protect, admin, checkRole } = require('../middleware/authMiddleware');

router.get('/template', downloadTemplate);
router.get('/network/info', getNetworkInfo);
router.get('/public/:id', getAssetById);
router.delete('/reset', protect, checkRole(['superadmin']), deleteAllAssets);

router.route('/')
    .get(protect, getAssets)
    .post(protect, admin, createAsset);

router.route('/import')
    .post(protect, admin, upload.single('file'), importExcel);

router.post('/:id/image', protect, checkRole('superadmin'), uploadImage.single('image'), uploadAssetImage);

router.route('/:id')
    .get(protect, getAssetById)
    .put(protect, checkRole('superadmin'), updateAsset)
    .delete(protect, checkRole('superadmin'), deleteAsset);

module.exports = router;
