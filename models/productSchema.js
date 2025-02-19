const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  price:{type:Number,required:true},
  images: [{ type: String, required: true }], 
  isListed: { type: Boolean, default: true },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  variants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variant" }],

  specifications: {
    material: { type: String, default: "Not specified" },
    sleeveType: {
      type: String,
      enum: ["Full sleeve", "Half sleeve", "Sleeveless"],
  },
    fitType: { type: String, default: "Regular" },
    pattern: { type: String, default: "Plain",required:false }
  },

  offer: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", default: null }
});

const Product = mongoose.model("Product",productSchema);
module.exports = Product
