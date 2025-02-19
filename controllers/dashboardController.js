const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const Variant = require("../models/variantSchema")
const bcrypt = require("bcrypt");


exports.getDashboard = (req,res)=>{
    res.render('admin/dashboard')
  }