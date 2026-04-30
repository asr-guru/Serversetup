const Log = require('../models/Log');
const Asset = require('../models/Asset');

// @desc    Get logs for a specific asset
// @route   GET /api/logs/:assetId
// @access  Private
const getLogsByAsset = async (req, res) => {
    try {
        const logs = await Log.find({ assetId: req.params.assetId }).sort({ date: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new log entry
// @route   POST /api/logs
// @access  Private
const createLog = async (req, res) => {
    try {
        const { assetId, action, remarks, assignedTo } = req.body;

        const asset = await Asset.findById(assetId);
        if (!asset) {
            res.status(404).json({ message: 'Asset not found' });
            return;
        }

        const log = new Log({
            assetId,
            action,
            user: req.user.name,
            remarks,
            assignedTo
        });

        const createdLog = await log.save();

        // Update asset status based on log action if needed
        if (action === 'Repair') {
            asset.status = 'Repair';
            await asset.save();
        } else if (action === 'Returned' || action === 'Maintenance') {
            asset.status = 'Active';
            await asset.save();
        }

        res.status(201).json(createdLog);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all logs
// @route   GET /api/logs
// @access  Private/Admin
const getLogs = async (req, res) => {
    try {
        const logs = await Log.find({})
            .populate('assetId', 'brand model assetId name')
            .sort({ date: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getLogs,
    getLogsByAsset,
    createLog
};
