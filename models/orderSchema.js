const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        variantId: { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },
        productName: { type: String, required: true },
        productDescription: { type: String, required: true },
        category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
        variantColor: { type: String, required: true },
        variantSize: { type: String, required: true },
        variantImage: { type: String, required: true },
        price: { type: Number, required: true },
        discount: { type: Number, default: 0, min: 0 }, // Per-unit discount (optional)
        quantity: { type: Number, required: true, min: 1 },
        cancelled: { type: Boolean, default: false },
        cancelledAt: { type: Date, default: null },
        cancellationReason: { type: String, default: null },
        returnRequested: { type: Boolean, default: false },
        returnRequestedAt: { type: Date, default: null },
        returnReason: { type: String, default: null },
        returned: { type: Boolean, default: false },
        returnedAt: { type: Date, default: null },
      },
    ],
    grossPrice: { type: Number, required: true }, // Before discounts/coupons
    discountAmount: { type: Number, default: 0, min: 0 }, // Total manual/promo discounts
    couponDiscountAmount: { type: Number, default: 0, min: 0 }, // Total coupon discount
    totalPrice: { type: Number, required: true }, // After all deductions + shipping
    shippingCost: { type: Number, default: 0 },
    address: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      enum: ["COD", "WALLET", "RAZORPAY", "STRIPE", "PAYPAL"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },
    orderStatus: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Return Requested"],
      default: "Pending",
    },
    trackingId: { type: String, default: null },
    couponApplied: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
    paymentId: { type: String, default: null },
    razorpayOrderId: { type: String, default: null },
    placedAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
    paymentDeadline: { type: Date, default: null },
  },
  { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;