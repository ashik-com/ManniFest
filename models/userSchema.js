const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: false },
  google_Id:{type:String,unique:true, sparse:true},
  isAdmin: { type: Boolean, default: false },
  name: { type: String, required: true },
  phone_number: { type: String, required: false },
  wallet_balance: { type: Number, default: 0 },
  isBlocked: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});



const User = mongoose.model("User", userSchema);
module.exports = User;