const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const variant = require("../models/variantSchema")
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer')
const Wallet = require("../models/walletSchema")
const Offer = require("../models/offersSchema")
require("dotenv").config();

let otpStore = {};
let Uemail;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


exports.getLoginPage = (req, res) => {
  let name = req.session.name ? req.session.name : "";
  res.render('user/login', { name: name })
}

exports.postLogin = async (req, res) => {

  const { email, password } = req.body;
  console.log(email)

  const existingUser = await User.findOne({ email });

  if (!existingUser) {
    return res.status(404).json({ success: false, message: 'User does not exist' });
  }

  const isMatch = await bcrypt.compare(password, existingUser.password_hash)

  if (!isMatch) {
    return res.status(400).json({ success: false, message: "Password does not match" })
  }
  
  req.session.name = existingUser.name;
  req.session.email = existingUser.email;
  return res.json({ success: true, message: 'Login successful!' });

}


exports.getforgot = (req, res) => {
  let name = req.session.name ? req.session.name : "";
  res.render('user/forgotpassword', { name: name });
}

exports.forgotOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const isExist = await User.findOne({ email });
  if (!isExist) {
    return res.status(400).json({ message: "User not found!" })
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 60 * 1000;

  otpStore[email] = { otp, expiresAt }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}. It is valid for 1 minute.`,
    });

    res.json({ success: true, message: "OTP sent successfully" })

    setTimeout(() => delete otpStore[email], 60000)

  } catch (error) {

    res.status(500).json({ success: false, message: "Failed to sent OTP" })

  }


}

exports.verifyForgot = (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP are required" });

  }

  const storedOtp = otpStore[email];

  if (!storedOtp) {
    return res.status(400).json({ success: false, message: "OTP expired or not found" });
  }

  if (Date.now() > storedOtp.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ success: false, message: "OTP expired" });
  }

  if (storedOtp.otp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  delete otpStore[email];
  Uemail = email
  setTimeout(() => {
    Uemail = undefined
  }, 900000)


  res.json({ success: true, message: "OTP verified successfully" })

}


exports.getResetpassword = (req, res) => {
  res.render('user/resetpassword', { name: "" });
}

exports.postReset = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;
    let email = Uemail;



    if (!email || !email.includes("@")) {
      return res.json({ success: false, message: "Invalid email format!" });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters!" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match!" });
    }

    let hashedPassword;
    try {

      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }


      hashedPassword = await bcrypt.hash(password, 10);
      user.password_hash = hashedPassword;
      await user.save();
    

    } catch (err) {
      console.error("Hashing error:", err);
      return res.status(500).json({ success: false, message: "Error processing password!" });
    }

    return res.status(200).json({ success: true, message: "Reset Password successful! Please log in." });

  } catch (error) {

    console.error("Signup error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong! Try again later." });
  }
};


exports.getUpdate = (req, res) => {
  setTimeout(() => {
    res.status(200).json({ success: true })
  }, 90000);
};


exports.getVerification = (req, res) => {
  let name = req.session.name ? req.session.name : "";
  res.render('user/varification', { name: name })
}


exports.sentOtp = async (req, res) => {
  const { email } = req.body;
  console.log("otppppppppppppppppppppppppppppppp:",email)

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 60 * 1000;

  otpStore[email] = { otp, expiresAt }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}. It is valid for 1 minute.`,
    });

    res.json({ success: true, message: "OTP sent successfully" })

    setTimeout(() => delete otpStore[email], 60000)

  } catch (error) {

    res.status(500).json({ success: false, message: "Failed to sent OTP" })

  }

}


const { v4: uuidv4 } = require('uuid'); // Ensure this is imported

exports.verifyOtp = async (req, res) => {
  const { email, otp, newUser } = req.body;



  // Validate required fields
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP are required" });
  }

  if (!newUser || typeof newUser !== 'object') {
    return res.status(400).json({ success: false, message: "User data is required" });
  }

  // Check OTP existence and validity
  const storedOtp = otpStore[email];
  console.log("otp testing here",storedOtp)
  if (!storedOtp) {
    return res.status(400).json({ success: false, message: "OTP expired or not found" });
  }

  if (Date.now() > storedOtp.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ success: false, message: "OTP expired" });
  }

  if (storedOtp.otp !== otp) {
    return res.status(400).json({ success: false, message: "Invalid OTP" });
  }

  delete otpStore[email];

  try {
    let referredByUser = null;
    if (newUser.referredBy) {
      referredByUser = await User.findOne({ referralCode: newUser.referredBy });
      if (!referredByUser) {
        return res.status(400).json({ success: false, message: "Invalid referral code!" });
      }
    }

    const userData = {
      ...newUser,
      referredBy: referredByUser ? referredByUser.referralCode : null,
    };

    // Create and save user
    const user = new User(userData);
    await user.save();

    // Create or find wallet for new user
    let userWallet = await Wallet.findOne({ userId: user._id });
    if (!userWallet) {
      userWallet = new Wallet({
        userId: user._id,
        balance: 0,
        transactions: []
      });
      await userWallet.save();
    }

    // Handle referrer bonus if applicable
    if (referredByUser) {
      let referrerWallet = await Wallet.findOne({ userId: referredByUser._id });
      if (!referrerWallet) {
        referrerWallet = new Wallet({
          userId: referredByUser._id,
          balance: 0,
          transactions: []
        });
      }

      const referralAmount = 50;
      const transactionDate = new Date();

      // Update referrer wallet with transaction
      referrerWallet.balance += referralAmount;
      referrerWallet.transactions.push({
        amount: referralAmount,
        type: "credit", // Matches enum in schema
        description: "Referral bonus for new user signup",
        date: transactionDate,
        orderId: null // No order associated with referral bonus
      });

      await referrerWallet.save();
    }

    // Set session data
    req.session.name = user.name;
    req.session.email = user.email;
    req.session.userId = user._id;

    return res.status(200).json({
      success: true,
      message: "OTP verified and user registered successfully",
      user: {
        name: user.name,
        email: user.email,
        referralCode: user.referralCode,
        wallet_balance: userWallet.balance
      }
    });
  } catch (error) {
    console.error("Error saving user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register user. Please try again later.",
    });
  }
};

exports.getSignup = (req, res) => {
  let name = req.session.name ? req.session.name : "";
  res.render('user/signup', { name: name });
}



exports.postSignup = async (req, res) => {
  try {
    const { name,email, password, confirmPassword,referredBy } = req.body;
    
    console.log(name)

    if (!name || name.length < 3) {
      return res.status(400).json({ success: false, message: "Name must be at least 3 characters!" });
    }

    if (!email || !email.includes("@")) {
      return res.json({ success: false, message: "Invalid email format!" });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters!" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match!" });
    }


    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: "Email already registered! Try logging in." });
    }

    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, 10);
    } catch (err) {
      console.error("Hashing error:", err);
      return res.status(500).json({ success: false, message: "Error processing password!" });
    }

    let referredByUser = null;
    if (referredBy) {
      referredByUser = await User.findOne({ referralCode: referredBy });
      if (!referredByUser) {
        return res.status(400).json({ success: false, message: "Invalid referral code!" });
      }
    }


    const newUser = new User({
      name,
      email,
      password_hash: hashedPassword,
      referredBy: referredByUser ? referredByUser.referralCode : null,
      referralCode: `${name.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    });
    console.log(newUser)
    

    return res.status(200).json({ success: true,user:newUser, message: "Signup successful! Please log in." });

  } catch (error) {

    console.error("Signup error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong! Try again later." });
  }
};




exports.postRegister = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }

    
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

   
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      first_name: firstName,
      last_name: lastName,
      email: email,
      password_hash: hashedPassword,
    });
    await newUser.save();

    res.status(201).json({ message: "Registration successful!" });
  } catch (error) {
    console.error("Error in registerUser:", error);
    res.status(500).json({ error: "Server error." });
  }
};


exports.getHome = async (req, res) => {
  let name = req.session?.name ? req.session?.name : "";
  try {
    const categorys = await Category.find({isListed:true})
    const products = await Product.find({ isListed: true }).populate('variants').lean();
    const newArrivals = await Product.find().populate('variants').sort({ createdAt: -1 }).limit(6);
    res.render('user/home', { name, products,categorys,newArrivals })
    

  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Internal Server Error");
  }

}


exports.getShop = async (req, res) => {
  try {
    const { category, sort, search } = req.query;
    const priceMin = parseInt(req.query.priceMin) || 0;
    const priceMax = parseInt(req.query.priceMax) || 5000;
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    let name = req.session.name || "";

    const categorys = await Category.find({ isListed: true }).lean();
    const listedCategoryIds = categorys.map(cat => cat._id);

    let query = {
      isListed: true,
      category: { $in: listedCategoryIds },
      baseprice: { $gte: priceMin, $lte: priceMax }
    };

    if (category) {
      query.category = { $in: category.split(",") };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    let sortOption = {};
    switch (sort) {
      case "price-Assending": sortOption = { baseprice: 1 }; break;
      case "price-Dessending": sortOption = { baseprice: -1 }; break;
      case "letter-Assending": sortOption = { name: 1 }; break;
      case "letter-Dessending": sortOption = { name: -1 }; break;
      default: sortOption = {};
    }

    // Fetch active offers (both category and product)
    const now = new Date();
    const offers = await Offer.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).lean();

    // Separate offers into category and product maps
    const categoryOfferMap = new Map();
    const productOfferMap = new Map();
    offers.forEach(offer => {
      if (offer.type === "category") {
        categoryOfferMap.set(offer.categoryId.toString(), {
          discountType: offer.discountType,
          discountValue: offer.discountValue
        });
      } else if (offer.type === "product") {
        productOfferMap.set(offer.productId.toString(), {
          discountType: offer.discountType,
          discountValue: offer.discountValue
        });
      }
    });

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);
    const products = await Product.find(query)
      .populate({ path: "variants", select: "color size price stock images" })
      .populate("category", "name")
      .collation({ locale: "en", strength: 2 })
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Apply the largest offer (product or category)
    const enhancedProducts = products.map(product => {
      const categoryOffer = categoryOfferMap.get(product.category._id.toString());
      const productOffer = productOfferMap.get(product._id.toString());
      let discountedPrice = product.baseprice;
      let discountPercentage = null;
      let hasOffer = false;
      let appliedOfferType = null;

      // Calculate discount from category offer
      let categoryDiscountedPrice = product.baseprice;
      if (categoryOffer) {
        if (categoryOffer.discountType === "percentage") {
          categoryDiscountedPrice = product.baseprice * (1 - categoryOffer.discountValue / 100);
        } else if (categoryOffer.discountType === "fixed") {
          categoryDiscountedPrice = Math.max(0, product.baseprice - categoryOffer.discountValue);
        }
      }

      // Calculate discount from product offer
      let productDiscountedPrice = product.baseprice;
      if (productOffer) {
        if (productOffer.discountType === "percentage") {
          productDiscountedPrice = product.baseprice * (1 - productOffer.discountValue / 100);
        } else if (productOffer.discountType === "fixed") {
          productDiscountedPrice = Math.max(0, product.baseprice - productOffer.discountValue);
        }
      }

      // Choose the largest discount (lowest price)
      if (productOffer && (!categoryOffer || productDiscountedPrice < categoryDiscountedPrice)) {
        discountedPrice = productDiscountedPrice;
        hasOffer = true;
        appliedOfferType = "product";
        discountPercentage = productOffer.discountType === "percentage"
          ? productOffer.discountValue
          : ((product.baseprice - discountedPrice) / product.baseprice * 100).toFixed(0);
      } else if (categoryOffer) {
        discountedPrice = categoryDiscountedPrice;
        hasOffer = true;
        appliedOfferType = "category";
        discountPercentage = categoryOffer.discountType === "percentage"
          ? categoryOffer.discountValue
          : ((product.baseprice - discountedPrice) / product.baseprice * 100).toFixed(0);
      }

      return {
        ...product,
        categoryName: product.category.name,
        originalPrice: product.baseprice,
        discountedPrice: discountedPrice.toFixed(2),
        hasOffer,
        discountPercentage,
        appliedOfferType // Optional: for debugging or display
      };
    });

    if (req.xhr) {
      return res.json({
        products: enhancedProducts,
        currentPage: page,
        totalPages,
        totalProducts
      });
    }

    res.render("user/shop", {
      name,
      products: enhancedProducts,
      currentPage: page,
      totalPages,
      categorys,
      totalProducts,
      search
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    if (req.xhr) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
    res.status(500).render("user/shop", {
      name: req.session.name || "",
      products: [],
      currentPage: 1,
      totalPages: 0,
      categorys: [],
      totalProducts: 0,
      search: "",
      error: "Failed to load products. Please try again later."
    });
  }
};

exports.getProductDetails = async (req, res) => {
  const name = req.session.name || undefined;

  try {
    const productId = req.params.id;
    const color = req.params.color;

    // Fetch product with variants
    const product = await Product.findOne({ _id: productId, isListed: true })
      .populate("variants")
      .lean();

    if (!product) {
      return res.redirect("/shop");
    }

    // Fetch category
    const category = product.category
      ? await Category.findById(product.category).lean()
      : null;

    // Fetch all variants for the product (assuming 'variant' is your Variant model)
    const varianta = await variant.find({ productId }).lean();

    // Fetch active offers (both category and product)
    const now = new Date();
    const offers = await Offer.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
      $or: [
        { type: "category", categoryId: product.category },
        { type: "product", productId: product._id }
      ]
    }).lean();

    // Separate offers
    const categoryOffer = offers.find(offer => offer.type === "category");
    const productOffer = offers.find(offer => offer.type === "product");

    // Function to calculate discounted price
    const calculateDiscountedPrice = (price, offer) => {
      if (!offer) return price;
      if (offer.discountType === "percentage") {
        return price * (1 - offer.discountValue / 100);
      } else if (offer.discountType === "fixed") {
        return Math.max(0, price - offer.discountValue);
      }
      return price;
    };

    // Apply largest discount to base product
    let discountedPrice = product.baseprice;
    let discountPercentage = null;
    let hasOffer = false;
    let appliedOfferType = null;

    const categoryDiscountedPrice = calculateDiscountedPrice(product.baseprice, categoryOffer);
    const productDiscountedPrice = calculateDiscountedPrice(product.baseprice, productOffer);

    if (productOffer && (!categoryOffer || productDiscountedPrice < categoryDiscountedPrice)) {
      discountedPrice = productDiscountedPrice;
      hasOffer = true;
      appliedOfferType = "product";
      discountPercentage = productOffer.discountType === "percentage"
        ? productOffer.discountValue
        : ((product.baseprice - discountedPrice) / product.baseprice * 100).toFixed(0);
    } else if (categoryOffer) {
      discountedPrice = categoryDiscountedPrice;
      hasOffer = true;
      appliedOfferType = "category";
      discountPercentage = categoryOffer.discountType === "percentage"
        ? categoryOffer.discountValue
        : ((product.baseprice - discountedPrice) / product.baseprice * 100).toFixed(0);
    }

    const enhancedProduct = {
      ...product,
      originalPrice: product.baseprice,
      discountedPrice: discountedPrice.toFixed(2),
      hasOffer,
      discountPercentage,
      appliedOfferType // Optional: for debugging/display
    };

    // Enhance variants with largest offer
    const enhancedVariants = varianta.map(variant => {
      let variantDiscountedPrice = variant.price;
      const variantCategoryDiscountedPrice = calculateDiscountedPrice(variant.price, categoryOffer);
      const variantProductDiscountedPrice = calculateDiscountedPrice(variant.price, productOffer);

      if (productOffer && (!categoryOffer || variantProductDiscountedPrice < variantCategoryDiscountedPrice)) {
        variantDiscountedPrice = variantProductDiscountedPrice;
        hasOffer = true;
        discountPercentage = productOffer.discountType === "percentage"
          ? productOffer.discountValue
          : ((variant.price - variantDiscountedPrice) / variant.price * 100).toFixed(0);
      } else if (categoryOffer) {
        variantDiscountedPrice = variantCategoryDiscountedPrice;
        hasOffer = true;
        discountPercentage = categoryOffer.discountType === "percentage"
          ? categoryOffer.discountValue
          : ((variant.price - variantDiscountedPrice) / variant.price * 100).toFixed(0);
      }

      return {
        ...variant,
        originalPrice: variant.price,
        discountedPrice: variantDiscountedPrice.toFixed(2),
        hasOffer,
        discountPercentage
      };
    });

    // Fetch and enhance related products
    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: product._id }, // Exclude current product
      isListed: true
    })
      .populate("variants")
      .lean();

    const enhancedRelatedProducts = relatedProducts.map(rp => {
      const rpCategoryDiscountedPrice = calculateDiscountedPrice(rp.baseprice, categoryOffer);
      const rpProductOffer = offers.find(offer => offer.type === "product" && offer.productId.toString() === rp._id.toString());
      const rpProductDiscountedPrice = calculateDiscountedPrice(rp.baseprice, rpProductOffer);

      let rpDiscountedPrice = rp.baseprice;
      let rpDiscountPercentage = null;
      let rpHasOffer = false;

      if (rpProductOffer && (!categoryOffer || rpProductDiscountedPrice < rpCategoryDiscountedPrice)) {
        rpDiscountedPrice = rpProductDiscountedPrice;
        rpHasOffer = true;
        rpDiscountPercentage = rpProductOffer.discountType === "percentage"
          ? rpProductOffer.discountValue
          : ((rp.baseprice - rpDiscountedPrice) / rp.baseprice * 100).toFixed(0);
      } else if (categoryOffer) {
        rpDiscountedPrice = rpCategoryDiscountedPrice;
        rpHasOffer = true;
        rpDiscountPercentage = categoryOffer.discountType === "percentage"
          ? categoryOffer.discountValue
          : ((rp.baseprice - rpDiscountedPrice) / rp.baseprice * 100).toFixed(0);
      }

      return {
        ...rp,
        originalPrice: rp.baseprice,
        discountedPrice: rpDiscountedPrice.toFixed(2),
        hasOffer: rpHasOffer,
        discountPercentage: rpDiscountPercentage
      };
    });

    const colors = [...new Set(varianta.map(v => v.color?.toLowerCase()))];

    if (req.xhr && color) {
      const availableVariants = await variant.find({
        productId,
        color: { $regex: new RegExp(`^${color}$`, "i") }
      }).lean();

      const enhancedAvailableVariants = availableVariants.map(variant => {
        let variantDiscountedPrice = variant.price;
        const variantCategoryDiscountedPrice = calculateDiscountedPrice(variant.price, categoryOffer);
        const variantProductDiscountedPrice = calculateDiscountedPrice(variant.price, productOffer);

        if (productOffer && (!categoryOffer || variantProductDiscountedPrice < variantCategoryDiscountedPrice)) {
          variantDiscountedPrice = variantProductDiscountedPrice;
          hasOffer = true;
          discountPercentage = productOffer.discountType === "percentage"
            ? productOffer.discountValue
            : ((variant.price - variantDiscountedPrice) / variant.price * 100).toFixed(0);
        } else if (categoryOffer) {
          variantDiscountedPrice = variantCategoryDiscountedPrice;
          hasOffer = true;
          discountPercentage = categoryOffer.discountType === "percentage"
            ? categoryOffer.discountValue
            : ((variant.price - variantDiscountedPrice) / variant.price * 100).toFixed(0);
        }

        return {
          ...variant,
          originalPrice: variant.price,
          discountedPrice: variantDiscountedPrice.toFixed(2),
          hasOffer,
          discountPercentage
        };
      });

      return res.json({ success: true, variants: enhancedAvailableVariants });
    }

    res.render("user/product-details", {
      name,
      product: enhancedProduct,
      category,
      varianta: enhancedVariants,
      relatedProducts: enhancedRelatedProducts,
      colors
    });

  } catch (error) {
    console.error("Error fetching product details:", error);
    res.redirect("/shop");
  }
};


exports.error = (req, res) => {
  res.status(404).render('user/404error')
}

exports.logout = (req, res) => {
  // req.session.destroy((error) => {
  //   if (error) {
  //     console.error("Error distroying session:", err);
  //     return res.status(500).json({ message: "Logout failed" })
  //   }

  //   res.clearCookie('connect.sid');
  //   res.status(200).json({ message: "Logged out succefully" });
  // })

  if(req.session.name && req.session.email){
    delete req.session.name 
    delete req.session.email
  }
  res.status(200).json({message:"Logged out succefully"})

}