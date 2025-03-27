const Cart = require("../models/cartSchema");
const Variant = require("../models/variantSchema");
const Product = require("../models/productSchema"); 
const User = require("../models/userSchema");
const Offer = require("../models/offersSchema"); 


const calculatePriceWithOffers = async (productId, variantPrice) => {
  const now = new Date();
  const offers = await Offer.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [
      { type: "product", productId },
      { type: "category", categoryId: (await Product.findById(productId)).category }
    ]
  }).lean();

  const productOffer = offers.find(offer => offer.type === "product");
  const categoryOffer = offers.find(offer => offer.type === "category");

  let originalPrice = variantPrice;
  let discountedPrice = variantPrice;
  let hasOffer = false;
  let discountPercentage = null;

  const calcDiscount = (price, offer) => {
    if (offer.discountType === "percentage") {
      return price * (1 - offer.discountValue / 100);
    } else if (offer.discountType === "fixed") {
      return Math.max(0, price - offer.discountValue);
    }
    return price;
  };

  const productDiscountedPrice = productOffer ? calcDiscount(variantPrice, productOffer) : variantPrice;
  const categoryDiscountedPrice = categoryOffer ? calcDiscount(variantPrice, categoryOffer) : variantPrice;

  if (productOffer && (!categoryOffer || productDiscountedPrice < categoryDiscountedPrice)) {
    discountedPrice = productDiscountedPrice;
    hasOffer = true;
    discountPercentage = productOffer.discountType === "percentage"
      ? productOffer.discountValue
      : ((variantPrice - discountedPrice) / variantPrice * 100).toFixed(0);
  } else if (categoryOffer) {
    discountedPrice = categoryDiscountedPrice;
    hasOffer = true;
    discountPercentage = categoryOffer.discountType === "percentage"
      ? categoryOffer.discountValue
      : ((variantPrice - discountedPrice) / variantPrice * 100).toFixed(0);
  }

  return { originalPrice, discountedPrice, hasOffer, discountPercentage };
};

exports.getCart = async (req, res) => {
  try {
    let name = req.session?.name ? req.session?.name : "";
    const email = req.session.email;

    if (!email) {
      return res.render("user/cart", {
        cart: null,
        user: null,
        name,
        messages: { error: "Please log in to view your cart" }
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.render("user/cart", {
        cart: null,
        user: null,
        name,
        messages: { error: "User not found. Please log in again." }
      });
    }
    const userId = user._id;

    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        select: "name baseprice description",
      })
      .populate({
        path: "items.variantId",
        select: "color size price stock images",
      })
      .lean();

    if (cart) {
      for (let item of cart.items) {
        const { originalPrice, discountedPrice, hasOffer, discountPercentage } = await calculatePriceWithOffers(
          item.productId._id,
          item.variantId.price
        );
        item.originalPrice = originalPrice;
        item.price = discountedPrice;
        item.hasOffer = hasOffer;
        item.discountPercentage = discountPercentage;
      }
      cart.totalPrice = cart.items.reduce((total, item) => total + item.price * item.quantity, 0);
    }

    res.render("user/cart", {
      cart: cart || { userId, items: [], totalPrice: 0 },
      user: userId,
      name,
      messages: {}
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).render("user/cart", {
      cart: null,
      user: null,
      name: "",
      messages: { error: "Server error" }
    });
  }
};

exports.addToCart = async (req, res) => {
  const { productId, variantId, quantity } = req.body;
  const email = req.session.email;

  try {
    // Check if user is authenticated
    if (!email) {
      return res.status(401).json({
        success: false,
        message: "Please log in to add items to cart",
      });
    }

    // Fetch user based on email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found. Please log in again.",
      });
    }
    const userId = user._id;

    
    const variant = await Variant.findById(variantId).populate("productId");
    if (!variant || variant.productId._id.toString() !== productId) {
      return res.status(404).json({
        success: false,
        message: "Variant not found or does not match the product",
      });
    }

    
    if (variant.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${variant.stock} items available in stock`,
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check if item already exists in cart
    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId && item.variantId.toString() === variantId
    );

    if (itemIndex > -1) {
      // Update quantity if item exists
      const newQuantity = cart.items[itemIndex].quantity + quantity;
      if (newQuantity > variant.stock) {
        return res.status(400).json({
          success: false,
          message: `Total quantity (${newQuantity}) exceeds available stock (${variant.stock})`,
        });
      }
      cart.items[itemIndex].quantity = newQuantity;
    } else {
      // Add new item to cart
      cart.items.push({
        productId,
        variantId,
        quantity
      });
    }

    // Save cart (totalPrice calculated in getCart)
    await cart.save();

    const cartCount = cart.items.length;
    res.json({ success: true, cartCount });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateCart = async (req, res) => {
  try {
    const { itemId, change } = req.body;
    const email = req.session.email;

    // Check if user is authenticated
    if (!email) {
      return res.status(401).json({ success: false, message: "Please log in" });
    }

    const user = await User.findOne({ email }); // Fixed: findOne instead of find
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    const userId = user._id;

    // Find the user's cart
    const cart = await Cart.findOne({ userId }).populate("items.variantId");
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    // Find the item in the items array by its _id
    const item = cart.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }

    // Get variant stock to check limits
    const variant = await Variant.findById(item.variantId);
    if (!variant) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    // Calculate new quantity
    const newQuantity = item.quantity + change;
    if (newQuantity < 1) {
      return res.status(400).json({ success: false, message: "Quantity cannot be less than 1" });
    }
   
    // Update quantity
    item.quantity = newQuantity;

    // Save the updated cart (totalPrice calculated in getCart)
    await cart.save();

    res.json({ success: true, cart });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.body;
    const email = req.session.email;

    // Check if user is authenticated
    if (!email) {
      return res.status(401).json({ success: false, message: "Please log in" });
    }

    const user = await User.findOne({ email }); // Fixed: findOne instead of find
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    const userId = user._id;

    // Find the user's cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" });
    }

    // Find the item index in the items array
    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: "Item not found in cart" });
    }

    // Remove the item
    cart.items.splice(itemIndex, 1);

    // Save the updated cart (totalPrice calculated in getCart)
    await cart.save();

    res.json({ success: true, cart });
  } catch (error) {
    console.error("Error removing from cart:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};