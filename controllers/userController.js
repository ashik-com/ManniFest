const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const variant = require("../models/variantSchema")
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer')
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
  }, 90000)


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


exports.verifyOtp = (req, res) => {
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
  }, 30000)

  res.json({ success: true, message: "OTP verified successfully" })
}


exports.getSignup = (req, res) => {
  let name = req.session.name ? req.session.name : "";
  res.render('user/signup', { name: name });
}



exports.postSignup = async (req, res) => {
  try {
    const { name, password, confirmPassword } = req.body;
    let email = Uemail;
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


    const newUser = new User({
      name,
      email,
      password_hash: hashedPassword
    });
    console.log(newUser)
    await newUser.save();
    req.session.name = name;

    return res.status(200).json({ success: true, message: "Signup successful! Please log in." });

  } catch (error) {

    console.error("Signup error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong! Try again later." });
  }
};




exports.postRegister = async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    // Check if user already exists
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
  let name = req.session.name ? req.session.name : "";
  try {
    const products = await Product.find({ isListed: true }).populate('variants').lean();
    console.log(products);
    res.render('user/home', { name, products })

  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Internal Server Error");
  }

}


exports.getShop = async (req, res) => {

  const {category,sort,search} = req.query
  const productsPerPage = 9
  let name = req.session.name ? req.session.name : "";
  
  console.log('searrrrrrrrrrrrrrrrrrrrrrrrrrrrch:',search)


  let query ={isListed:true}
  if(category){
    query.category = category;
  }
  let sortOption ={}
  
    switch (sort) {
      case "price-Assending":
        sortOption = { price: 1 }; 
        break;
      case "price-Dessending":
        sortOption = { price: -1 }; 
        break;
      case "letter-Assending":
        sortOption = { name: 1 }; 
        break;
      case "letter-Dessending":
        sortOption = { name: -1 }; 
        break;
      default:
        sortOption = {};
    }
    
  
    if(search){
      query.$or = [
        { name: { $regex: search, $options: "i" } },  
        { description: { $regex: search, $options: "i" } }  
      ]
    }else{
      delete query.$or;
    }

 
 
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * productsPerPage;

  const categorys = await Category.find({isListed:true}).lean();
  console.log(categorys);


  try {
    const totalProducts = await Product.countDocuments(query)
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    const products = await Product.find(query)
      .populate({
        path: "variants",
        select: "color size price stock images"
      })
      .collation({ locale: "en", strength: 2 })
      .sort(sortOption) 
      .skip(skip)
      .limit(productsPerPage)
      .lean();


      

    
      console.log('nnnnnnn',products);
    res.render('user/shop', {
      name,
      products,
      currentPage: page,
      totalPages,
      categorys,
      totalProducts,
      search,
    })

    //  res.setHeader("Content-Type","application/json").json({name,products,currentPage:page,totalPages,categorys,totalProducts,search})

  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Internal Server Error")
  }
}

exports.getProductDetails = async (req, res) => {
  const name = req.session.name ? req.session.name : undefined;
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).populate('variants').lean()
    const category = await Category.findById(product.category).lean()
    const varianta = await variant.findById(product.variants).lean()
    const relatedProducts = await Product.find({category:product.category}).populate('variants').lean()
    console.log(product)
    console.log("related products:",relatedProducts);
    
   console.log(varianta);


   

   

    
    
    

    if (!product) {
      return res.status(404).send("product not found")
    }

    res.render('user/product-details', { name, product,category,varianta,relatedProducts })

  } catch (error) {
    console.error("Error fetching product details:", error);
    res.status(500).send("Internal Server Error");

  }

}

exports.error = (req, res) => {
  res.render('user/404error')
}

exports.logout = (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Error distroying session:", err);
      return res.status(500).json({ message: "Logout failed" })
    }

    res.clearCookie('connect.sid');
    res.status(200).json({ message: "Logged out succefully" });
  })
}