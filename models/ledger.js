// models/LedgerEntry.js
const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true
    },
    account: {
        type: String,
        enum: ['Customer Wallet', 'Shop Revenue', 'Payment Gateway'], // Expand as needed
        required: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    transactionDate: {
        type: Date,
        default: Date.now
    },
    transactionType: {
        type: String,
        enum: ['CREDIT', 'DEBIT'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        required: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    paymentId: {
        type: String,
        default: null
    },
    balanceAfter: {
        type: Number,
        required: true
    }
}, { timestamps: true });

const LedgerEntry= mongoose.model('LedgerEntry', ledgerEntrySchema);
module.exports = LedgerEntry