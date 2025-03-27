const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  balance: { type: Number, default: 0 }, // Initial balance is 0
  transactions: [
    {
      amount: Number,
      type: { type: String, enum: ["credit", "debit"], required: true },
      description: String,
      date: { type: Date, default: Date.now },
      orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null }
    }
  ],
}, { timestamps: true });

const Wallet= mongoose.model("Wallet", walletSchema);
module.exports= Wallet;
