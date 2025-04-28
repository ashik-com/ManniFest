const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const Variant = require("../models/variantSchema")
const Order = require("../models/orderSchema")
const sendEmail = require("../utils/mailer")
const bcrypt = require("bcrypt");
const Wallet = require("../models/walletSchema")
const WalletTransaction = require("../models/walletTransactionSchema")
const LedgerEntry = require("../models/ledger")
const Coupon = require("../models/couponSchema")
const { v4: uuidv4 } = require('uuid');
const mongoose = require("mongoose");


exports.getLoginPage = (req, res) => {
  res.render("admin/login", { error: null });
};

exports.postLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await User.findOne({ email });
    if (!admin || !admin.isAdmin) {
      return res.status(401).json({ message: "Invalid email or not an admin" });
    }
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    req.session.adminId = admin._id;
    res.status(200).json({ message: "Login successful", redirectUrl: "/admin/dashboard" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error, please try again" });
  }
};


exports.getUser = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    let limit = 6;
    const searchQuery = req.query.search || "";
    const query = searchQuery
      ? { name: { $regex: searchQuery, $options: "i" } }
      : {};
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
    res.render("admin/users", { users, searchQuery, totalPages, currentPage: page, searchQuery });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Server error");
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { reason } = req.body;
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found!" });
    }
    user.isBlocked = !user.isBlocked;
    if (user.isBlocked) {
      user.blockedreason = reason || "No reason provided";
    } else {
      user.blockedreason = "";
    }
    await user.save();
    if (user.isBlocked) {
      const subject = "Your Account Has Been Blocked";
      const text = `Hello ${user.name},\n\nWe regret to inform you that your account has been blocked.\n\n📌 Reason: ${reason}\n\nIf you believe this is a mistake, please contact our support team.\n\nRegards,\nTeam MANNIFEST ECOMMERCE`;
      await sendEmail(user.email, subject, text);
    } else {
      const subject = "Your Account Has Been Unblocked";
      const text = `Hello ${user.name},\n\nGood news! Your account has been unblocked. You can now log in and continue using our services.\n\nRegards,\nTeam MANNIFEST ECOMMERCE`;
      await sendEmail(user.email, subject, text);
    }
    res.json({ success: true, isBlocked: user.isBlocked });
  } catch (error) {
    console.error(" Error blocking user:", error);
    res.status(500).json({ success: false, message: "Something went wrong." });
  }
};


exports.getCoupons = (req, res) => {
  res.render('admin/coupons')
}



const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

// Helper function to build search filter
const buildSearchFilter = async (searchQuery) => {
  const filter = {};
  if (searchQuery) {
    const regex = new RegExp(escapeRegex(searchQuery), "i");

    // Initialize $or array for multiple search conditions
    filter.$or = [
      { orderId: regex },
      { status: regex },
      { "items.productName": regex },
    ];

    // Search for users by email to include their orders
    const users = await User.find({ email: regex }, "_id");
    if (users.length > 0) {
      filter.$or.push({ userId: { $in: users.map((u) => u._id) } });
    }

    // If searchQuery is a valid ObjectId, include _id and userId search
    if (mongoose.Types.ObjectId.isValid(searchQuery)) {
      filter.$or.push(
        { _id: new mongoose.Types.ObjectId(searchQuery) },
        { userId: new mongoose.Types.ObjectId(searchQuery) }
      );
    }
  }
  return filter;
};

// Helper function to transform orders
const transformOrders = (orders) => {
  return orders.map((order) => {
    const userEmail = order.userId ? order.userId.email : "N/A";
    const allItemsCancelled = order.items.every((item) => item.cancelled);
    const activeItems = order.items.filter((item) => !item.cancelled);
    return {
      ...order.toObject(),
      userEmail,
      allItemsCancelled,
      hasActiveItems: activeItems.length > 0,
    };
  });
};

exports.getOrders = async (req, res) => {
  try {
    // Validate and sanitize inputs
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;
    const searchQuery = req.query.search ? String(req.query.search).trim() : "";

    // Build filter
    const filter = await buildSearchFilter(searchQuery);

    // Get total orders and calculate pages
    const totalOrders = await Order.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit) || 1;

    // Ensure page doesn't exceed totalPages
    const currentPage = Math.min(page, totalPages);

    // Fetch orders
    const orders = await Order.find(filter)
      .populate("userId", "email")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);

    // Transform orders
    const transformedOrders = transformOrders(orders);

    // Render response
    res.render("admin/orders", {
      orders: transformedOrders,
      searchQuery,
      totalPages,
      currentPage,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).render("admin/error", {
      message: "An error occurred while fetching orders.",
    });
  }
};

exports.orderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).send('Order not found');
    }
    const itemId = req.params.itemId;
    res.render('admin/order-details', { order, itemId });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
};


exports.updateStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Returned", "Return Requested"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Restrict changes for non-editable statuses
    if (order.orderStatus === "Cancelled") {
      return res.status(400).json({ success: false, message: "Cannot change status of a fully cancelled order" });
    }
    if (order.orderStatus === "Delivered") {
      return res.status(400).json({ success: false, message: "Cannot change status of a delivered order" });
    }
    if (order.orderStatus === "Returned") {
      return res.status(400).json({ success: false, message: "Cannot change status of a returned order" });
    }

    // Restrict Pending transitions
    if (order.orderStatus === "Pending" && status !== "Cancelled") {
      return res.status(400).json({ success: false, message: "Pending orders can only be cancelled" });
    }
    if (status === "Pending" && order.paymentStatus !== "Pending") {
      return res.status(400).json({ success: false, message: "Cannot set status to Pending unless payment is Pending" });
    }

    // Prevent delivery with no active items
    const activeItems = order.items.filter(item => !item.cancelled);
    if (activeItems.length === 0 && status === "Delivered") {
      return res.status(400).json({ success: false, message: "Cannot deliver an order with no active items" });
    }

    // Update order status
    order.orderStatus = status;
    if (status === "Delivered") {
      order.deliveredAt = new Date();
    }

    // Update payment status for Returned and Cancelled
    if (status === "Returned") {
      order.paymentStatus = "Refunded";
    } else if (status === "Cancelled") {
      order.paymentStatus = order.paymentStatus === "Paid" ? "Refunded" : "Failed";
    } else {
      // Existing payment status logic for other statuses
      if (order.paymentMethod === "COD") {
        order.paymentStatus = status === "Delivered" ? "Paid" : "Pending";
      } else {
        order.paymentStatus = (order.paymentId || order.razorpayOrderId) ? "Paid" : "Pending";
      }
    }

    await order.save();

    res.json({
      success: true,
      message: "Order status updated",
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      items: order.items.map(item => ({
        cancelled: item.cancelled,
        returnRequested: item.returnRequested,
        returned: item.returned
      }))
    });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === "development" ? error.message : "Server error"
    });
  }
};

exports.approveReturn = async (req, res) => {
  try {
    const { orderId, itemIndex } = req.params;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.items[itemIndex];
    if (!item || !item.returnRequested || item.returned) {
      return res.status(400).json({ success: false, message: "Item not found, no return requested, or already returned" });
    }
    
    item.returned = true;
    item.returnedAt = new Date();
    item.returnRequested = false;

    const variant = await Variant.findById(item.variantId);
    if (!variant) {
      return res.status(400).json({ success: false, message: "Variant not found" });
    }
    variant.stock += item.quantity;
    await variant.save();

    
    const activeItems = order.items.filter(i => !i.cancelled);
    if (activeItems.every(i => i.returned)) {
      order.orderStatus = "Returned";
    }

    let couponMinAmount;
    if(order.couponApplied){
      const coupon = await Coupon.findById(order.couponApplied);
      const { discountType, discountValue, minimumPurchase, maximumDiscount } = coupon;
      couponMinAmount= minimumPurchase

    }

    const itemSubtotal = item.price * item.quantity;
    let refundAmount = 0;
    const filteredItems = order.items.filter(item => !item.returned && !item.cancelled);
    if(filteredItems.length>=1){
      order.totalPrice - itemSubtotal > couponMinAmount ? refundAmount=itemSubtotal : refundAmount = itemSubtotal - order.couponDiscountAmount
    }else{
      refundAmount = order.totalPrice
    }
    const user = await User.findById(order.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      wallet = new Wallet({
        userId: user._id,
        balance: 0,
        transactions: []
      });
    }

    if (refundAmount > 0) {
      const transactionId = uuidv4();
      const transactionDate = new Date();
      wallet.balance = (wallet.balance || 0) + refundAmount;
      wallet.transactions.push({
        amount: refundAmount,
        type: 'credit',
        description: `Refund for return of ${item.productName} (Order: ${orderId})`,
        date: transactionDate
      });
      await wallet.save();

      const walletTransaction = new WalletTransaction({
        transactionId,
        userId: user._id,
        transactionType: 'CREDIT',
        amount: refundAmount,
        source: `Refund for return of ${item.productName} (Order: ${orderId})`,
        transactionDate,
        orderId,
        paymentId: null
      });
      await walletTransaction.save();
    }

    await order.save();

    res.json({
      success: true,
      message: refundAmount > 0
        ? `Return approved. ₹${refundAmount.toFixed(2)} refunded to user's wallet.`
        : "Return approved. No refund applicable.",
      balance: wallet.balance
    });
  } catch (error) {
    console.error("Error approving return:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login");
  });
};


exports.walletTransaction = async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const filter = {};
    if (searchQuery) {
      filter.$or = [
        { userId: { $regex: searchQuery, $options: 'i' } },
        { transactionId: { $regex: searchQuery, $options: 'i' } }
      ];
    }
    const totalTransactions = await WalletTransaction.countDocuments(filter);
    const totalPages = Math.ceil(totalTransactions / limit);
    const currentPage = Math.min(Math.max(page, 1), totalPages || 1);
    const transactions = await WalletTransaction.find(filter)
      .sort({ transactionDate: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);
    res.render('admin/wallet-transaction', {
      transactions,
      searchQuery,
      currentPage,
      totalPages
    });
  } catch (error) {
    console.error("Error fetching wallet transactions:", error);
    res.status(500).render('admin/wallet-transactions', {
      transactions: [],
      searchQuery: req.query.search || '',
      currentPage: 1,
      totalPages: 1,
      error: "Server error occurred while fetching transactions"
    });
  }
};


exports.getLedger = async (req, res) => {
  try {
    const searchQuery = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const filter = {};
    if (searchQuery) {
      filter.$or = [
        { userId: { $regex: searchQuery, $options: 'i' } },
        { transactionId: { $regex: searchQuery, $options: 'i' } }
      ];
    }
    const totalEntries = await LedgerEntry.countDocuments(filter);
    const totalPages = Math.ceil(totalEntries / limit);
    const currentPage = Math.min(Math.max(page, 1), totalPages || 1);
    const ledgerEntries = await LedgerEntry.find(filter)
      .sort({ transactionDate: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);
    res.render('admin/ledger', {
      ledgerEntries,
      searchQuery,
      currentPage,
      totalPages
    });
  } catch (error) {
    console.error("Error fetching ledger entries:", error);
    res.status(500).render('admin/ledger', {
      ledgerEntries: [],
      searchQuery: req.query.search || '',
      currentPage: 1,
      totalPages: 1,
      error: "Server error occurred while fetching ledger entries"
    });
  }
};