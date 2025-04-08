const Wallet = require("../models/walletSchema");
const User = require("../models/userSchema");
const Razorpay = require("razorpay");
const Cart = require("../models/cartSchema")
const mongoose = require("mongoose")
const Address = require("../models/addressSchema")
const Order = require("../models/orderSchema")
const Variant = require("../models/variantSchema")
const crypto = require("crypto");
const WalletTransaction = require("../models/walletTransactionSchema")
const { v4: uuidv4 } = require('uuid')
const LedgerEntry = require("../models/ledger")
const Offer = require("../models/offersSchema")
const Product = require("../models/productSchema")
const Coupon = require("../models/couponSchema")
require("dotenv").config();



const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.getWallet = async (req, res) => {
  try {
      const name = req.session.name || "";
      const user = await User.findOne({ email: req.session.email }).lean();

      if (!user) {
          return res.status(404).send("User not found");
      }

      // Fetch wallet and sort transactions by date in descending order
      const wallet = await Wallet.findOne({ userId: user._id })
          .lean()
          .then(wallet => {
              if (wallet && wallet.transactions) {
                  // Sort transactions by date (assuming there's a date field)
                  wallet.transactions.sort((a, b) => {
                      return new Date(b.date) - new Date(a.date);
                  });
              }
              return wallet;
          });

      if (req.xhr) {
          return res.render("user/partials/wallet", { name, user, wallet });
      }

      res.render("user/partials/wallet", { name, user, wallet });
  } catch (error) {
      console.error("Error fetching wallet:", error.message);
      res.status(500).send("Internal Server Error");
  }
};


exports.createWallet =async (req, res) => {
    try {
      const { amount } = req.body;
  
      
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid amount provided',
        });
      }
  
      
      const orderOptions = {
        amount: Math.round(amount * 100), 
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
      };
  
      
      const order = await razorpayInstance.orders.create(orderOptions);
  
      
      res.json({
        success: true,
        key_id: razorpayInstance.key_id, // Send key_id to frontend
        amount: order.amount,
        id: order.id,
      });
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create payment order',
      });
    }
  };


exports.verifyWalletPayment = async (req, res) => {
  try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

      // Input validation
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount) {
          return res.status(400).json({ success: false, message: "Missing payment details" });
      }

      const amountNum = Number(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
          return res.status(400).json({ success: false, message: "Invalid amount" });
      }

      const user = await User.findOne({ email: req.session.email });
      if (!user) {
          return res.status(404).json({ success: false, message: "User not found" });
      }

      // Verify Razorpay signature
      const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generatedSignature = hmac.digest("hex");

      if (generatedSignature !== razorpay_signature) {
          return res.status(400).json({ success: false, message: "Invalid payment signature" });
      }

      // Find or create wallet
      let wallet = await Wallet.findOne({ userId: user._id });
      if (!wallet) {
          wallet = new Wallet({
              userId: user._id,
              balance: 0,
              transactions: []
          });
      }

      // Check for duplicate transaction
      const paymentExists = wallet.transactions.some(t => t.paymentId === razorpay_payment_id);
      if (paymentExists) {
          return res.status(400).json({ success: false, message: "Payment already processed" });
      }

      // Prepare transaction data
      const amountInRupees = amountNum;
      const transactionId = uuidv4();
      const transactionDate = new Date();

      // Update wallet balance and embedded transactions
      wallet.balance += amountInRupees;
      wallet.transactions.push({
          amount: amountInRupees,
          type: "credit",
          description: "Wallet Top-up via Razorpay",
          date: transactionDate,
          paymentId: razorpay_payment_id // Not in original schema, but kept for consistency
      });
      await wallet.save();

      // Save to separate WalletTransaction collection
      const walletTransaction = new WalletTransaction({
          transactionId,
          userId: user._id,
          transactionType: 'CREDIT',
          amount: amountInRupees,
          source: 'Wallet Top-up via Razorpay',
          transactionDate,
          paymentId: razorpay_payment_id,
          orderId: null
      });
      await walletTransaction.save();

      const newBalance = wallet.balance + amountInRupees

      const ledgerEntry = new LedgerEntry({
        transactionId,
        userId: user._id,
        transactionDate,
        transactionType: 'CREDIT',
        amount: amountInRupees,
        description: 'Wallet Top-up via Razorpay',
        paymentId: razorpay_payment_id,
        balanceAfter: newBalance
    });
    await ledgerEntry.save();

      res.json({ 
          success: true, 
          message: "Money added successfully!", 
          balance: wallet.balance 
      });
  } catch (error) {
      console.error("Payment verification error:", error.message);
      if (!res.headersSent) {
          res.status(500).json({ success: false, message: "Payment verification failed" });
      }
  }
};


exports.getBalance = async (req,res)=>{
    try {
        if(req.session.email){
            return res.status(500).json({success:false,message:"user not found! Please login"})
        }

        const user = await User.findOne({email:req.session.email})
        const wallet = await Wallet.findOne({userId:user._id})
        console.log

        res.json({
            success:true,
            balance:wallet.balance
        })
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch wallet balance',
          });
        
    }
}

// Define calculatePriceWithOffers locally
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
  console.log("Offers found:", offers);

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

exports.payWithWallet = async (req, res) => {
  try {
    const {
      addressId,
      couponCode,
      grossPrice,
      discountAmount,
      couponDiscountAmount,
      totalAmount,
      items,
      shippingCost,
      shippingMethod,
    } = req.body;

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ success: false, message: "Request body is required" });
    }
    console.log("Wallet checkout details:", req.body);

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
    console.log("User ID:", userId);

    // Cart validation
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

    // Address validation
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

    // Shipping method validation
    const validShippingMethods = ["standard", "express"];
    if (!shippingMethod || !validShippingMethods.includes(shippingMethod)) {
      return res.status(400).json({
        success: false,
        message: `Invalid shipping method. Must be one of: ${validShippingMethods.join(', ')}`,
      });
    }

    // Items validation
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

    // Calculate pricing with offers
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

    // Validate received values against calculated values
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

    // Check wallet balance
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(400).json({ success: false, message: "Wallet not found. Please add funds." });
    }
    if (wallet.balance < calculatedTotalPrice) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance. Please add funds.",
      });
    }

    // Create order
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
      paymentMethod: "WALLET",
      shippingMethod,
      couponApplied: couponId || null,
      orderStatus: "Processing",
      paymentStatus: "Paid",
      placedAt: new Date(),
    });

    // Stock updates
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

    // Update wallet
    const transactionId = uuidv4();
    const transactionDate = new Date();
    const newBalance = wallet.balance - calculatedTotalPrice;
    if (isNaN(newBalance)) {
      throw new Error("Calculated wallet balance is invalid (NaN)");
    }
    wallet.balance = newBalance;
    wallet.transactions.push({
      amount: calculatedTotalPrice,
      type: "debit",
      description: `Order payment for ${orderItems.length} item(s)`,
      date: transactionDate,
    });
    await wallet.save();

    // Save to WalletTransaction collection
    const walletTransaction = new WalletTransaction({
      transactionId,
      userId,
      transactionType: "DEBIT",
      amount: calculatedTotalPrice,
      source: `Order Payment for ${orderItems.length} item(s)`,
      transactionDate,
      orderId: order._id,
      paymentId: null,
    });
    await walletTransaction.save();

    // Save to LedgerEntry collection
    const ledgerEntry = new LedgerEntry({
      transactionId,
      userId,
      transactionDate,
      transactionType: "DEBIT",
      amount: calculatedTotalPrice,
      description: `Order Payment for ${orderItems.length} item(s)`,
      orderId: order._id,
      paymentId: null,
      balanceAfter: newBalance,
    });
    await ledgerEntry.save();

    // Update coupon usage
    if (couponId) {
      await Coupon.updateOne({ _id: couponId }, { $push: { usedBy: userId } });
    }

    // Delete cart
    await Cart.deleteOne({ userId });

    return res.status(200).json({
      success: true,
      orderId: order._id,
      message: "Order placed successfully using wallet",
      balance: wallet.balance,
    });
  } catch (error) {
    console.error("Wallet checkout error:", error.stack);
    const message = error.message.includes("Out of stock")
      ? error.message
      : "Checkout failed. Please try again.";
    return res.status(500).json({ success: false, message });
  }
};