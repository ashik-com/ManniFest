const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const Variant = require("../models/variantSchema")
const bcrypt = require("bcrypt");


exports.getLoginPage = (req, res) => {
  res.render("admin/login", { error: null });
};

exports.postLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const admin = await User.findOne({ email });
    console.log(admin.password_hash)
    console.log(password)

    if (!admin || !admin.isAdmin) {
      return res.status(401).json({ message: "Invalid email or not an admin" });
    }

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    req.session.adminId = admin._id;
    console.log(req.session.adminId)

    res.status(200).json({ message: "Login successful", redirectUrl: "/admin/dashboard" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error, please try again" });
  }
};


exports.getUser = async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }) 
      .sort({ createdAt: -1 }); 

    res.render("admin/users", { users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).send("Server error");
  }
};

exports.blockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.json({ message: "User status updated", isBlocked: user.isBlocked });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ message: "Server error" });
  }
};




exports.getCoupons = (req,res)=>{
  res.render('admin/coupons')
}

exports.getOffers = (req,res)=>{
  res.render('admin/offers')
}


exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin/login",{error:null});
  });
};