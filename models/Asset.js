const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
    assetId: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    model: {
        type: String,
        required: true
    },
    serialNumber: {
        type: String,
        required: true,
        unique: true
    },
    purchaseDate: {
        type: Date
    },
    location: {
        type: String,
        required: true
    },
    name: {
        type: String,
        default: ''
    },
    assignedTo: {
        type: String,
        default: 'N/A'
    },
    userEmail: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['Active', 'Repair', 'Scrap', 'In Use', 'In Stock', 'Reserved'],
        default: 'Active'
    },
    imageUrl: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Asset', assetSchema);
