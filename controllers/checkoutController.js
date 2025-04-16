const Cart = require("../models/cartSchema")
const Variant = require("../models/variantSchema")
const Product = require("../models/productSchema")
const User = require("../models/userSchema")
const Address = require("../models/addressSchema")
const Order = require("../models/orderSchema")
const mongoose = require('mongoose');
const Razorpay = require("razorpay")
require("dotenv").config();
const crypto = require("crypto");
const Wallet = require("../models/walletSchema")
const Coupon = require("../models/couponSchema")
const Offer = require("../models/offersSchema")


const razorpayInstance = new Razorpay({
    key_id:"rzp_test_tjJjQR24zip1H0",     
    key_secret:"zcPsjKytVzZsT15GqYHVGWTq"    
  });



    const calculatePriceWithOffers = async (productId, variantPrice) => {
    console.log("Calculating price for product:", productId);
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
  
    const productDiscountedPrice = productOffer ? calcDiscount(originalPrice, productOffer) : originalPrice;
    const categoryDiscountedPrice = categoryOffer ? calcDiscount(originalPrice, categoryOffer) : originalPrice;
  
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

    console.log("this is original priece",originalPrice)
    console.log("discount price", discountedPrice)
  
    return { originalPrice, discountedPrice, hasOffer, discountPercentage };
  };



  exports.getCheckout = async (req, res) => {
    try {
      console.log("Entering getCheckout");
      if (!req.session || !req.session.email) {
        req.flash("error", "Please log in to proceed.");
        console.log("Redirecting to login - no session");
        return res.status(401).redirect("/user/login");
      }
      const name = req.session.name || "";
      console.log("Session name:", name);
      const user = await User.findOne({ email: req.session.email });
      if (!user) {
        req.flash("error", "User not found. Please log in again.");
        console.log("Redirecting to login - no user");
        return res.status(404).redirect("/user/login");
      }
      console.log("User found:", user._id);
      const userId = user._id;

      const addresses = await Address.find({ userId });
      console.log("Addresses found:", addresses.length);

      const cart = await Cart.findOne({ userId })
        .populate({
          path: "items.productId",
          model: "Product",
          select: "name baseprice description category"
        })
        .populate({
          path: "items.variantId",
          model: "Variant",
          select: "color size price stock images maxQuantity"
        })
        .lean();
  
      if (!cart) {
        req.flash("error", "Cart not found. Please add items to proceed.");
        console.log("Redirecting to cart - no cart");
        return res.status(404).redirect("/user/cart");
      }
  
      if (cart.items.length === 0) {
        req.flash("error", "Your cart is empty. Add items before checking out.");
        console.log("Redirecting to cart - empty cart");
        return res.status(400).redirect("/user/cart");
      }
    
      const validationErrors = [];
      
      for (let item of cart.items) {
        if (!item.productId || !item.variantId) {
          validationErrors.push("Invalid product or variant in cart");
          continue;
        }
        const { originalPrice, discountedPrice, hasOffer, discountPercentage } = await calculatePriceWithOffers(
          item.productId._id,
          item.variantId.price
        );
        
        item.originalPrice = originalPrice;
        item.price = discountedPrice;
        item.hasOffer = hasOffer;
        item.discountPercentage = discountPercentage;
  
        if (item.variantId.stock < item.quantity) {
          validationErrors.push(
            `Insufficient stock for ${item.productId.name} (${item.variantId.color}, ${item.variantId.size}): Available: ${item.variantId.stock}, Requested: ${item.quantity}`
          );
        }
  
        const maxQuantity = item.variantId.maxQuantity || 5;
        if (item.quantity > maxQuantity) {
          validationErrors.push(
            `${item.productId.name} exceeds maximum allowed quantity (${maxQuantity})`
          );
        }
  
        
        if (item.quantity <= 0) {
          validationErrors.push(
            `${item.productId.name} has invalid quantity (${item.quantity})`
          );
        }

        if (item.price < 0) {
          validationErrors.push(
            `${item.productId.name} has invalid price (${item.price})`
          );
        }
      }
  
      if (validationErrors.length > 0) {
        req.flash("error", validationErrors.join(". "));
        console.log("Redirecting to cart - validation errors:", validationErrors);
        return res.status(400).redirect("/user/cart");
      }
  
    
      const subtotal = cart.items.reduce((sum, item) => {
        const itemTotal = item.price * item.quantity;
        return sum + (isNaN(itemTotal) ? 0 : itemTotal);
      }, 0);
  
      if (isNaN(subtotal) || subtotal < 0) {
        req.flash("error", "Invalid cart total calculation");
        console.log("Redirecting to cart - invalid subtotal");
        return res.status(400).redirect("/user/cart");
      }
  
      const shippingCost = 0; 
      const totalAmount = subtotal + shippingCost;
      console.log("Subtotal:", subtotal, "Total:", totalAmount);
      const wallet = await Wallet.findOne({ userId });
      console.log("Wallet found:", wallet ? wallet.balance : "No wallet");
      if (wallet && wallet.balance < 0) {
        req.flash("error", "Invalid wallet balance");
        console.log("Redirecting to cart - invalid wallet");
        return res.status(400).redirect("/user/cart");
      }

      const coupons = await Coupon.find({ 
        isActive: true, 
        expiryDate: { $gt: new Date() },
        minimumPurchase: { $lte: subtotal },
        usedBy: { $ne: userId } 
      });
      console.log("Coupons found:", coupons.length);

      
      console.log("here is cart",cart)
      console.log("Rendering checkout page");
      return res.status(200).render("user/checkout", {
        name,
        user,
        addresses,
        cart,
        subtotal,
        shippingCost,
        totalAmount,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        wallet,
        coupons
      });
  
    } catch (error) {
      console.error("Error in getCheckout:", error);
      req.flash("error", "Something went wrong. Please try again.");
      return res.status(500).redirect("/user/cart");
    }
  };


  exports.postCheckout = async (req, res) => {
    try {
      const {
        addressId,
        paymentMethod,
        couponCode,
        grossPrice,
        discountAmount,
        couponDiscountAmount,
        totalAmount,
        items,
        shippingCost,
        shippingMethod,
      } = req.body;
        
        console.log("gross price",grossPrice)
        console.log("discount amount",discountAmount)
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ success: false, message: "Request body is required" });
      }
      console.log("Checkout details:", req.body);
  
      
      if (!req.session || !req.session.email) {
        return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
      }
  
      
      const user = await User.findOne({ email: req.session.email });
      if (!user) {
        return res.status(401).json({ success: false, message: "User not found. Please log in again." });
      }
      const userId = user._id;
      console.log("User ID:", userId);
  
      
      const cart = await Cart.findOne({ userId })
        .populate({
          path: "items.productId",
          model: "Product",
          populate: { path: "category", model: "Category" },
        })
        .populate({
          path: "items.variantId",
          model: "Variant",
        });
  
      if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        return res.status(400).json({ success: false, message: "Your cart is empty" });
      }
      console.log("Cart:", cart.items.length);
  
      
      const address = await Address.findOne({ _id: addressId, userId });
      if (!address) {
        return res.status(400).json({ success: false, message: "Invalid address selection" });
      }
      const requiredAddressFields = ['addressLine1', 'pinCode', 'mobileNumber', 'fullName', 'city', 'state', 'country'];
      const missingFields = requiredAddressFields.filter(field => !address[field]);
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required address fields: ${missingFields.join(', ')}`,
        });
      }
      console.log("Address:", address._id);
  
     
      const formattedPaymentMethod = paymentMethod?.toUpperCase();
      const validPaymentMethods = ["COD", "RAZORPAY", "WALLET"];
      if (!formattedPaymentMethod || !validPaymentMethods.includes(formattedPaymentMethod)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}`,
        });
      }
      console.log("Payment method:", formattedPaymentMethod);
  
     
      const validShippingMethods = ["standard", "express"];
      if (!shippingMethod || !validShippingMethods.includes(shippingMethod)) {
        return res.status(400).json({
          success: false,
          message: `Invalid shipping method. Must be one of: ${validShippingMethods.join(', ')}`,
        });
      }
  
      
      if (!Array.isArray(items) || items.length !== cart.items.length) {
        return res.status(400).json({ success: false, message: "Invalid items data" });
      }
  
      const validationErrors = [];
      for (let i = 0; i < cart.items.length; i++) {
        const cartItem = cart.items[i];
        const reqItem = items[i];
  
        if (!cartItem.variantId || !cartItem.productId) {
          validationErrors.push(`Invalid product/variant data for item ${i + 1}`);
          continue;
        }
  
        const maxQuantity = cartItem.variantId.maxQuantity || 5;
        if (!reqItem.quantity || reqItem.quantity <= 0 || reqItem.quantity > maxQuantity) {
          validationErrors.push(
            `${cartItem.productId.name}: Quantity must be between 1 and ${maxQuantity}`
          );
        }
  
        if (cartItem.variantId.stock < reqItem.quantity) {
          return res.status(400).json({
            success: false,
            message: `${cartItem.productId.name} (${cartItem.variantId.color}, ${cartItem.variantId.size}): Out of stock. Available: ${cartItem.variantId.stock}, Requested: ${reqItem.quantity}`,
          });
        }
  
        if (!reqItem.price || reqItem.price < 0) {
          validationErrors.push(`${cartItem.productId.name}: Invalid price`);
        }
      }
  
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Cart validation failed: " + validationErrors.join("; "),
        });
      }
  
      
      let calculatedGrossPrice = 0;
      const orderItems = await Promise.all(
        items.map(async (item, index) => {
          const cartItem = cart.items[index];
          const priceWithOffer = await calculatePriceWithOffers(cartItem.productId._id, item.price);
          calculatedGrossPrice += priceWithOffer.originalPrice * item.quantity;

          console.log("priceWithOffer.originalPrice",priceWithOffer.originalPrice)
  
          return {
            productId: cartItem.productId._id,
            variantId: cartItem.variantId?._id || null,
            productName: cartItem.productId.name,
            productDescription: cartItem.productId.description,
            category: cartItem.productId.category._id,
            variantColor: cartItem.variantId?.color || "N/A",
            variantSize: cartItem.variantId?.size || "N/A",
            variantImage: cartItem.variantId?.images[0] || cartItem.productId.images[0],
            price: priceWithOffer.originalPrice, 
            discount: item.originalPrice - priceWithOffer.originalPrice, 
            quantity: item.quantity,
          };
        })
      );
  
      const calculatedShippingCost = parseFloat(shippingCost);
      let calculatedDiscountAmount = parseFloat(discountAmount) || 0; 
      let calculatedCouponDiscountAmount = 0;
  
      let couponId = null;
      if (couponCode) {
        const coupon = await Coupon.findOne({
          code: couponCode,
          isActive: true,
          expiryDate: { $gt: new Date() },
          minimumPurchase: { $lte: calculatedGrossPrice },
        });
  
        if (!coupon) {
          return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
        }
  
        if (coupon.usedBy && coupon.usedBy.includes(userId)) {
          return res.status(400).json({ success: false, message: "Coupon already used" });
        }
  
        couponId = coupon._id;
        if (coupon.discountType === "percentage") {
          calculatedCouponDiscountAmount = calculatedGrossPrice * (coupon.discountValue / 100);
          if (coupon.maximumDiscount && calculatedCouponDiscountAmount > coupon.maximumDiscount) {
            calculatedCouponDiscountAmount = coupon.maximumDiscount;
          }
        } else if (coupon.discountType === "fixed") {
          calculatedCouponDiscountAmount = coupon.discountValue;
        }
      }
  
      const calculatedTotalPrice =
        calculatedGrossPrice - calculatedDiscountAmount - calculatedCouponDiscountAmount + calculatedShippingCost;
  
      
      if (
        Math.abs(parseFloat(grossPrice) - calculatedGrossPrice) > 0.01 ||
        Math.abs(parseFloat(discountAmount || 0) - calculatedDiscountAmount) > 0.01 ||
        Math.abs(parseFloat(couponDiscountAmount || 0) - calculatedCouponDiscountAmount) > 0.01 ||
        Math.abs(parseFloat(shippingCost) - calculatedShippingCost) > 0.01 ||
        Math.abs(parseFloat(totalAmount) - calculatedTotalPrice) > 0.01
      ) {
        return res.status(400).json({
          success: false,
          message: "Pricing mismatch",
          expected: {
            grossPrice: calculatedGrossPrice,
            discountAmount: calculatedDiscountAmount,
            couponDiscountAmount: calculatedCouponDiscountAmount,
            shippingCost: calculatedShippingCost,
            totalPrice: calculatedTotalPrice,
          },
          received: { grossPrice, discountAmount, couponDiscountAmount, shippingCost, totalAmount },
        });
      }
  
      
      const order = new Order({
        userId,
        items: orderItems,
        grossPrice: calculatedGrossPrice,
        discountAmount: calculatedDiscountAmount,
        couponDiscountAmount: calculatedCouponDiscountAmount,
        totalPrice: calculatedTotalPrice,
        shippingCost: calculatedShippingCost,
        address: {
          fullName: address.fullName,
          phone: address.mobileNumber,
          street: address.addressLine1,
          city: address.city,
          state: address.state,
          zipCode: address.pinCode,
          country: address.country,
        },
        paymentMethod: formattedPaymentMethod,
        shippingMethod,
        couponApplied: couponId || null,
        orderStatus: "Processing",
        paymentStatus: formattedPaymentMethod === "COD" ? "Pending" : "Paid",
        placedAt: new Date(),
      });
  
     
      for (const item of cart.items) {
        const result = await Variant.findOneAndUpdate(
          { _id: item.variantId._id, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true }
        );
        if (!result) {
          throw new Error(`Out of stock: ${item.productId.name} (${item.variantId.size}, ${item.variantId.color})`);
        }
      }
  
      await order.save();
      await Cart.deleteOne({ userId });
  
     
      if (couponId) {
        await Coupon.updateOne({ _id: couponId }, { $push: { usedBy: userId } });
      }
  
      return res.status(200).json({
        success: true,
        orderId: order._id,
        message: "Order placed successfully",
      });
    } catch (error) {
      console.error("Checkout error:", error.stack);
      const message = error.message.includes("Out of stock")
        ? error.message
        : "Checkout failed. Please try again.";
      return res.status(500).json({ success: false, message });
    }
  };

exports.orderSuccess = async (req, res) => {
    try {
        const { orderId } = req.query;
        if (!orderId) {
            return res.status(400).send("Order ID is required");
        }


        const order = await Order.findById(orderId).lean();
        if (!order) {
            return res.status(404).send("Order not found");
        }

        // Calculate estimated delivery (e.g., 5 days from now)
        const estimatedDelivery = new Date();
        estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);
        const formattedDelivery = estimatedDelivery.toLocaleDateString();

        // Render the order success page with data
        res.render('user/order-success', {
            name: req.session.name || 'Guest', // Pass user name if available
            orderId,
            order,
            estimatedDelivery: formattedDelivery
        });
    } catch (error) {
        console.error("Error rendering order success page:", error);
        res.status(500).send("Server error");
    }
};


exports.createRazorpayOrder = async (req, res) => {
  try {
    const {
      addressId,
      paymentMethod,
      couponCode,
      grossPrice,
      discountAmount,
      couponDiscountAmount,
      totalAmount,
      items,
      shippingCost,
      shippingMethod,
    } = req.body;
    const currency = "INR";
    console.log("Razorpay items", req.body);

    
    if (!req.session?.email) {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }

    
    const user = await User.findOne({ email: req.session.email });
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found. Please log in again." });
    }
    const userId = user._id;

    
    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        model: "Product",
        populate: { path: "category", model: "Category" },
      })
      .populate({
        path: "items.variantId",
        model: "Variant",
      });

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Your cart is empty." });
    }

    if (!items || items.length !== cart.items.length) {
      return res.status(400).json({ success: false, message: "Cart items mismatch." });
    }

   
    for (let i = 0; i < cart.items.length; i++) {
      const cartItem = cart.items[i];
      const reqItem = items[i];
      if (cartItem.variantId.stock < reqItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `${cartItem.productId.name} (${cartItem.variantId.color}, ${cartItem.variantId.size}): Out of stock. Available: ${cartItem.variantId.stock}, Requested: ${reqItem.quantity}`,
        });
      }
    }

    
    const address = await Address.findOne({ _id: addressId, userId });
    if (!address || !address.addressLine1 || !address.pinCode || !address.mobileNumber) {
      return res.status(400).json({ success: false, message: "Invalid address selection." });
    }

   
    const formattedPaymentMethod = paymentMethod?.toUpperCase();
    if (formattedPaymentMethod !== "RAZORPAY") {
      return res.status(400).json({ success: false, message: "Invalid payment method for Razorpay." });
    }

    
    const maxPendingOrders = 1;
    const pendingRazorpayOrders = await Order.countDocuments({
      userId,
      paymentMethod: "RAZORPAY",
      paymentStatus: "Pending",
    });
    if (pendingRazorpayOrders >= maxPendingOrders) {
      return res.status(429).json({
        success: false,
        message: `You already have ${maxPendingOrders} pending Razorpay order${maxPendingOrders > 1 ? "s" : ""}. Please complete or cancel it before placing a new one.`,
      });
    }

    
    const invalidQuantityItems = cart.items.filter(item => item.quantity > 5);
    if (invalidQuantityItems.length > 0) {
      return res.status(400).json({ success: false, message: "Max 5 units per product allowed." });
    }

    
    let calculatedGrossPrice = 0;
    const orderItems = await Promise.all(
      items.map(async (item, index) => {
        const cartItem = cart.items[index];
        const priceWithOffer = await calculatePriceWithOffers(cartItem.productId._id, item.price);
        calculatedGrossPrice += priceWithOffer.originalPrice * item.quantity;

        return {
          productId: cartItem.productId._id,
          variantId: cartItem.variantId?._id || null,
          productName: cartItem.productId.name,
          productDescription: cartItem.productId.description,
          category: cartItem.productId.category._id,
          variantColor: cartItem.variantId?.color || "N/A",
          variantSize: cartItem.variantId?.size || "N/A",
          variantImage: cartItem.variantId?.images[0] || cartItem.productId.images[0],
          price: priceWithOffer.originalPrice, 
          discount: item.originalPrice - priceWithOffer.originalPrice, 
          quantity: item.quantity,
        };
      })
    );

    const calculatedShippingCost = parseFloat(shippingCost);
    let calculatedDiscountAmount = parseFloat(discountAmount) || 0; 
    let calculatedCouponDiscountAmount = 0;

    let couponId = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode,
        isActive: true,
        expiryDate: { $gt: new Date() },
        minimumPurchase: { $lte: calculatedGrossPrice },
      });
      if (coupon) {
        couponId = coupon._id;
        if (coupon.discountType === "percentage") {
          calculatedCouponDiscountAmount = calculatedGrossPrice * (coupon.discountValue / 100);
          if (coupon.maximumDiscount && calculatedCouponDiscountAmount > coupon.maximumDiscount) {
            calculatedCouponDiscountAmount = coupon.maximumDiscount;
          }
        } else if (coupon.discountType === "fixed") {
          calculatedCouponDiscountAmount = coupon.discountValue;
        }
      }
    }

    const calculatedTotalPrice =
      calculatedGrossPrice - calculatedDiscountAmount - calculatedCouponDiscountAmount + calculatedShippingCost;

    
    if (
      Math.abs(parseFloat(grossPrice) - calculatedGrossPrice) > 0.01 ||
      Math.abs(parseFloat(discountAmount || 0) - calculatedDiscountAmount) > 0.01 ||
      Math.abs(parseFloat(couponDiscountAmount || 0) - calculatedCouponDiscountAmount) > 0.01 ||
      Math.abs(parseFloat(shippingCost) - calculatedShippingCost) > 0.01 ||
      Math.abs(parseFloat(totalAmount) - calculatedTotalPrice) > 0.01
    ) {
      return res.status(400).json({
        success: false,
        message: "Pricing mismatch",
        expected: {
          grossPrice: calculatedGrossPrice,
          discountAmount: calculatedDiscountAmount,
          couponDiscountAmount: calculatedCouponDiscountAmount,
          shippingCost: calculatedShippingCost,
          totalPrice: calculatedTotalPrice,
        },
        received: { grossPrice, discountAmount, couponDiscountAmount, shippingCost, totalAmount },
      });
    }

    const amountInPaise = Math.round(calculatedTotalPrice * 100);

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: amountInPaise,
      currency,
      receipt: `receipt_${Date.now()}`,
      payment_capture: 1,
    });

    for (const item of cart.items) {
      if (!item.variantId) {
        throw new Error(`No variant specified for product: ${item.productId.name}`);
      }
      const result = await Variant.updateOne(
        { _id: item.variantId._id, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } }
      );
      if (result.modifiedCount === 0) {
        throw new Error(`Insufficient stock for ${item.productId.name} (${item.variantId.size}, ${item.variantId.color})`);
      }
    }

    const order = new Order({
      userId,
      items: orderItems,
      grossPrice: calculatedGrossPrice,
      discountAmount: calculatedDiscountAmount,
      couponDiscountAmount: calculatedCouponDiscountAmount,
      totalPrice: calculatedTotalPrice,
      shippingCost: calculatedShippingCost,
      address: {
        fullName: address.fullName,
        phone: address.mobileNumber,
        street: address.addressLine1,
        city: address.city,
        state: address.state,
        zipCode: address.pinCode,
        country: address.country,
      },
      paymentMethod: formattedPaymentMethod,
      couponApplied: couponId || null,
      paymentStatus: "Pending",
      orderStatus: "Pending",
      razorpayOrderId: razorpayOrder.id,
      placedAt: new Date(),
      paymentDeadline: new Date(Date.now() + 30 * 60 * 1000), 
    });

    await order.save();
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });


    if (couponId) {
      await Coupon.updateOne({ _id: couponId }, { $push: { usedBy: userId } });
    }

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      key_id: process.env.RAZORPAY_KEY_ID,
      orderId: order._id,
      paymentDeadline: order.paymentDeadline,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ success: false, message: "Failed to create order" });
  }
};

exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;

    // Validate request body
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
      return res.status(400).json({ success: false, message: "Invalid payment details." });
    }

    // Session validation
    if (!req.session || !req.session.email) {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }

    // User validation
    const user = await User.findOne({ email: req.session.email });
    if (!user) {
      return res.status(401).json({ success: false, message: "User not found. Please log in again." });
    }
    const userId = user._id;

    // Find order and verify ownership
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or does not belong to this user.",
      });
    }

    // Check payment deadline
    if (new Date() > order.paymentDeadline) {
      return res.status(400).json({
        success: false,
        message: "Payment deadline has expired. Please place a new order.",
      });
    }

    // Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed. Signature mismatch.",
      });
    }

    // Update order status
    order.paymentStatus = "Paid";
    order.orderStatus = "Processing";
    order.transactionId = razorpay_payment_id;
    await order.save();

    // Update coupon usage if applied
    if (order.couponApplied) {
      try {
        const couponUpdate = await Coupon.updateOne(
          { _id: order.couponApplied },
          { $push: { usedBy: order.userId } }
        );
        if (couponUpdate.modifiedCount === 0) {
          console.warn(`Coupon ${order.couponApplied} not updated; possibly already used or not found.`);
        }
      } catch (couponError) {
        console.error("Error updating coupon usage:", couponError);
        // Not failing the response, but logging the issue
      }
    }

    // Send success response
    res.json({
      success: true,
      message: "Payment verified successfully!",
      orderId: order._id,
      totalPrice: order.totalPrice, // Optional: Useful for frontend confirmation
    });
  } catch (error) {
    console.error("Error verifying Razorpay payment:", error.stack);
    res.status(500).json({ success: false, message: "Failed to verify payment." });
  }
};


exports.checkPendingRazorpay = async (req, res) => {
    try {
        
        if (!req.session || !req.session.email) {
            return res.status(401).json({ 
                success: false, 
                message: "Session expired. Please log in again." 
            });
        }

        const user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: "User not found. Please log in again." 
            });
        }
        const userId = user._id;

        
        const pendingOrder = await Order.findOne({
            userId: userId,
            paymentMethod: 'RAZORPAY',
            paymentStatus: 'Pending'
        }).lean();

       
        if (pendingOrder) {
            
            if (new Date() > pendingOrder.paymentDeadline) {
              
                return res.json({ 
                    success: false, 
                    message: "Pending order payment deadline has expired." 
                });
            }

            return res.json({
                success: true,
                pendingOrder: {
                    orderId: pendingOrder._id,
                    razorpayOrderId: pendingOrder.razorpayOrderId,
                    totalPrice: pendingOrder.totalPrice,
                    address: {
                        fullName: pendingOrder.address.fullName,
                        phone: pendingOrder.address.phone,
                        street: pendingOrder.address.street,
                        city: pendingOrder.address.city,
                        state: pendingOrder.address.state,
                        zipCode: pendingOrder.address.zipCode,
                        country: pendingOrder.address.country
                    },
                    addressId: pendingOrder.addressId || pendingOrder._id 
                }
            });
        } else {
            return res.json({ 
                success: false, 
                message: "No pending Razorpay orders found." 
            });
        }
    } catch (error) {
        console.error("Error checking pending Razorpay orders:", error.stack);
        return res.status(500).json({ 
            success: false, 
            message: "Server error while checking pending orders." 
        });
    }
};


exports.retryRazorpayPayment = async (req, res) => {
    try {
        // Step 1: Session Validation
        if (!req.session || !req.session.email) {
            return res.status(401).json({ 
                success: false, 
                message: "Session expired. Please log in again." 
            });
        }

        // Step 2: Fetch User
        const user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: "User not found." 
            });
        }
        const userId = user._id;

        // Step 3: Extract Order ID from Request Body
        const { orderId } = req.body;
        if (!orderId) {
            return res.status(400).json({ 
                success: false, 
                message: "Order ID is required." 
            });
        }

        // Step 4: Find Pending Razorpay Order
        const order = await Order.findOne({
            _id: orderId,
            userId: userId,
            paymentMethod: 'RAZORPAY',
            paymentStatus: 'Pending'
        });

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "No pending Razorpay order found with the provided ID." 
            });
        }

        // Step 5: Check Payment Deadline
        if (new Date() > order.paymentDeadline) {
            // Optionally update the order status here or rely on a cron job
            return res.status(400).json({ 
                success: false, 
                message: "Payment deadline has expired. Please place a new order." 
            });
        }

        // Step 6: Prepare and Send Response
        res.status(200).json({
            success: true,
            order: {
                id: order.razorpayOrderId,
                amount: order.totalPrice * 100, // Convert to paise as Razorpay expects
                currency: 'INR'
            },
            key_id: process.env.RAZORPAY_KEY_ID,
            orderId: order._id
        });
    } catch (error) {
        console.error("Error in retry Razorpay payment:", error.stack);
        return res.status(500).json({ 
            success: false, 
            message: "Server error during retry attempt." 
        });
    }
};


exports.orderfailed = async (req, res) => {
  try {
      const { orderId } = req.query;
      if (!orderId) {
          return res.status(400).send("Order ID is required");
      }


      const order = await Order.findById(orderId).lean();
      if (!order) {
          return res.status(404).send("Order not found");
      }

      // Calculate estimated delivery (e.g., 5 days from now)
      const estimatedDelivery = new Date();
      estimatedDelivery.setDate(estimatedDelivery.getDate() + 5);
      const formattedDelivery = estimatedDelivery.toLocaleDateString();

      // Render the order success page with data
      res.render('user/transaction-failure', {
          name: req.session.name || 'Guest', // Pass user name if available
          orderId,
          order,
          estimatedDelivery: formattedDelivery
      });
  } catch (error) {
      console.error("Error rendering order success page:", error);
      res.status(500).send("Server error");
  }
}

