const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: false }, 
  google_Id: { type: String, unique: true, sparse: true },
  isAdmin: { type: Boolean, default: false },
  name: { type: String, required: true },
  wallet_balance: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
  blockedreason: { type: String, default: "" },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },

  profileImage: { type: String, default: "default.jpg" },

  addresses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Address" }],

  orders: [{ type: mongoose.Schema.Types.ObjectId, ref: "Order" }],

  otp: { type: String },  
  otpExpires: { type: Date },
  referralCode: { type: String, unique: true },
  referredBy:{type:String},
  reward_points:{type:Number,default:0},

});


userSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

const User = mongoose.model("User", userSchema);
module.exports = User;
