const mongoose = require("mongoose");

const variantSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    color: { type: String, required: true },
    size: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true, min: 0 },
    images: [{ type: String, required: true }]
  });
  
  const Variant = mongoose.model("Variant", variantSchema);
  module.exports = Variant