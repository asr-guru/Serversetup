const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    assetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Asset',
        required: true
    },
    action: {
        type: String,
        enum: ['Issued', 'Returned', 'Repair', 'Transfer', 'Maintenance'],
        required: true
    },
    user: {
        type: String, // Name of the person who performed the action
        required: true
    },
    assignedTo: {
        type: String, // Name of the person receiving the asset (if applicable)
        default: 'N/A'
    },
    date: {
        type: Date,
        default: Date.now
    },
    remarks: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Log', logSchema);
