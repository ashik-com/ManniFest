const Order = require("../models/orderSchema");
const Cart = require("../models/cartSchema");
const Variant = require("../models/variantSchema");
const Product = require("../models/productSchema")





exports.placeOrder = async (req, res) => {
    try {
        const { userId, address, paymentMethod, transactionId, couponApplied } = req.body;

        // Fetch user's cart
        const cart = await Cart.findOne({ userId }).populate("items.productId items.variantId");

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        let totalPrice = 0;
        const orderItems = cart.items.map(item => {
            totalPrice += item.price * item.quantity;

            return {
                productId: item.productId._id,
                variantId: item.variantId._id,
                productName: item.productId.name,
                productDescription: item.productId.description,
                category: item.productId.category,
                variantColor: item.variantId.color,
                variantSize: item.variantId.size,
                variantImage: item.variantId.images[0], // Storing the first variant image
                price: item.price,
                quantity: item.quantity
            };
        });

        // Reduce stock for each variant
        for (let item of cart.items) {
            await Variant.findByIdAndUpdate(item.variantId._id, {
                $inc: { stock: -item.quantity }
            });
        }

        // Create order
        const newOrder = new Order({
            userId,
            items: orderItems,
            totalPrice,
            address,
            paymentMethod,
            transactionId: paymentMethod !== "COD" ? transactionId : null,
            couponApplied: couponApplied || null
        });

        await newOrder.save();

        // Clear the cart after order placement
        await Cart.findOneAndDelete({ userId });

        return res.status(201).json({ success: true, message: "Order placed successfully", orderId: newOrder._id });

    } catch (error) {
        console.error("Order Placement Error:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
