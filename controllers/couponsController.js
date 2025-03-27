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









exports.getCoupon =async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      let limit = 6;

      const searchQuery = req.query.search || ""

      const query = searchQuery
      ? {name:{$regex:searchQuery,$options: "i" }}
      : {};

      const totalCoupon = await Coupon.countDocuments(query);
      const totalPages = Math.ceil(totalCoupon / limit);

      
      const coupons = await Coupon.find(query) 
        .sort({ createdAt: -1 })
        .skip((page -1)*limit)
        .limit(limit)
        .lean()
  
      res.render("admin/coupons", { coupons,totalPages, currentPage:page, searchQuery });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).send("Server error");
    }
  };

  exports.getAddCoupons = (req,res)=>{
    try {
      res.render("admin/addCoupons")
    } catch (error) {
      
    }
  }

  exports.postAddCoupon = async (req, res) => {
    try {
        console.log("kk",req.body);
        const {
            code,
            discountType,
            discountValue,
            minimumPurchase,
            maximumDiscount,
            expiryDate,
            isActive
        } = req.body;

        // Validation with single-message responses
        const codeRegex = /^[A-Z0-9]+$/;
        if (!code || !codeRegex.test(code)) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code must contain only letters and numbers (no spaces or special characters)'
            });
        }

        if (!['percentage', 'fixed'].includes(discountType)) {
            return res.status(400).json({
                success: false,
                message: 'Discount type must be either "percentage" or "fixed"'
            });
        }

        const discountValueNum = parseFloat(discountValue);
        if (isNaN(discountValueNum) || discountValueNum <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Discount value must be greater than zero'
            });
        }
        if (discountType === 'percentage' && (discountValueNum < 1 || discountValueNum > 100)) {
            return res.status(400).json({
                success: false,
                message: 'Percentage discount must be between 1 and 100'
            });
        }

        const minPurchaseNum = parseFloat(minimumPurchase);
        if (isNaN(minPurchaseNum) || minPurchaseNum < 0) {
            return res.status(400).json({
                success: false,
                message: 'Minimum purchase cannot be negative'
            });
        }

        const maxDiscountNum = parseFloat(maximumDiscount);
        if (isNaN(maxDiscountNum) || maxDiscountNum < 0) {
            return res.status(400).json({
                success: false,
                message: 'Maximum discount amount cannot be negative'
            });
        }
        if (discountType === 'fixed' && maxDiscountNum > 0 && maxDiscountNum < discountValueNum) {
            return res.status(400).json({
                success: false,
                message: 'Maximum discount amount cannot be less than the fixed discount value'
            });
        }

        const expiry = new Date(expiryDate);
        const currentDate = new Date();
        if (isNaN(expiry.getTime()) || expiry <= currentDate) {
            return res.status(400).json({
                success: false,
                message: 'Expiry date must be in the future'
            });
        }

        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: 'Coupon code already exists'
            });
        }

        const coupon = new Coupon({
            code,
            discountType,
            discountValue: discountValueNum,
            minimumPurchase: minPurchaseNum,
            maximumDiscount: maxDiscountNum,
            expiryDate: expiry,
            isActive: isActive === 'on' || isActive === true || isActive === 'true'
        });

        await coupon.save();
        return res.status(201).json({
            success: true,
            message: 'Coupon created successfully'
        });
    } catch (error) {
        console.error('Error creating coupon:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.validateCoupon = async (req, res) => {
  const { code } = req.query;
  try {
      const coupon = await Coupon.findOne({ code, isActive: true });
      if (!coupon || coupon.expiryDate < new Date()) {
          return res.json({ success: false, message: "Invalid or expired coupon" });
      }
      res.json({
          success: true,
          coupon: {
              code: coupon.code,
              discountType: coupon.discountType,
              discountValue: coupon.discountValue,
              minimumPurchase: coupon.minimumPurchase,
              maximumDiscount: coupon.maximumDiscount
          }
      });
  } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
  }
};


exports.deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        
        // Permanently delete the coupon
        const deletedCoupon = await Coupon.findByIdAndDelete(couponId);
        
        if (!deletedCoupon) {
            return res.status(404).json({ 
                success: false, 
                message: 'Coupon not found' 
            });
        }

        res.status(200).json({ 
            success: true, 
            message: 'Coupon deleted successfully' 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting coupon',
            error: error.message 
        });
    }
};