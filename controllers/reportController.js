const Asset = require('../models/Asset');
const Log = require('../models/Log');

// @desc    Get summary statistics for dashboard
// @route   GET /api/reports/summary
// @access  Private
const getSummary = async (req, res) => {
    try {
        const totalAssets = await Asset.countDocuments();
        const activeAssets = await Asset.countDocuments({ status: 'Active' });
        const repairAssets = await Asset.countDocuments({ status: 'Repair' });
        const scrapAssets = await Asset.countDocuments({ status: 'Scrap' });
        
        const recentLogs = await Log.find({})
            .populate('assetId', 'assetId type brand model')
            .sort({ date: -1 })
            .limit(10);

        res.json({
            totalAssets,
            activeAssets,
            repairAssets,
            scrapAssets,
            recentLogs
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get assets grouped by type
// @route   GET /api/reports/assets-by-type
// @access  Private
const getAssetsByType = async (req, res) => {
    try {
        const stats = await Asset.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getSummary,
    getAssetsByType
};
