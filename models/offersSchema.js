// models/offersSchema.js
const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    type: { type: String, enum: ['product', 'category'], required: true }, // Distinguish between product and category offers
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }, // Optional for category offers
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null }, // Optional for product offers
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    discountValue: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }, // Renamed from expiryDate for consistency with frontend
    categoryName: { type: String, default: null }, // Optional, only for category offers
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update updatedAt before saving
offerSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Offer = mongoose.model('Offer', offerSchema);
module.exports = Offer;