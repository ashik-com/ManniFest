const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", required: true },
    quantity: { type: Number, required: true, min: 1 }
  }],
  totalPrice: { type: Number, default: 0 } // Calculated dynamically
}, { timestamps: true });

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;