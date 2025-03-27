const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User collection
        required: true,
    },
    transactionDate: {
        type: Date,
        default: Date.now,
    },
    transactionType: {
        type: String,
        enum: ['CREDIT', 'DEBIT'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    source: {
        type: String,
        default: null,
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order', // Reference to the Order collection (optional)
        default: null,
    },
}, { timestamps: true }); // Adds createdAt and updatedAt fields

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
module.exports = WalletTransaction;