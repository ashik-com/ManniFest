const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  description: { type: String, required:true, trim: true },
  isListed: { type: Boolean, default: true }, 
  status: { 
    type: String, 
    enum: ["active", "inactive"], 
    default: "active" 
  },
  offer: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Offer", 
    default: null 
  },
  createdAt: { type: Date, default: Date.now },
});
const Category= mongoose.model("Category", categorySchema);
module.exports = Category
