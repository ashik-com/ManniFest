
const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema({
  referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  refereeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  referralCodeUsed: { type: String, required: true },
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  rewardStatus: { type: String, enum: ["pending", "issued"], default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

const Referral = mongoose.model("Referral", referralSchema);
module.exports = Referral;