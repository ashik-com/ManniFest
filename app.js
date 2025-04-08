const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('./config/db');
const path = require('path');
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require('nodemailer');
const session = require('express-session');
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require('./routes/userRoutes');
const ejs = require('ejs');
const nocache = require('nocache');
const passport = require('passport');
const bcrypt = require("bcrypt");
const flash = require("connect-flash");
const helmet = require('helmet');
const Razorpay = require('razorpay');
const { startCleanupJob } = require('./middlewares/orderCleanUp');

connectDB();
const app = express();


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(nocache());

app.use(bodyParser.json());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use("/uploads", express.static("uploads"));


app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'","https://api.razorpay.com"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", 
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com", 
        "https://checkout.razorpay.com" 
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", 
        "https://fonts.googleapis.com", 
        "https://cdn.jsdelivr.net", 
        "https://cdnjs.cloudflare.com" 
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com" 
      ],
      imgSrc: [
        "'self'",
        "data:",
        "http://localhost:4000", 
        "https://img.icons8.com",
        "https://res.cloudinary.com", 
      ],
      connectSrc: ["'self'", "https://api.razorpay.com",
        "https://api.razorpay.com", 
        "https://lumberjack.razorpay.com"

      ], 
      frameSrc: ["https://api.razorpay.com", "https://checkout.razorpay.com"], 
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(cors({
  origin: "*",
  methods: "GET,POST,PUT,DELETE",
  allowedHeaders: "Content-Type, Authorization"
}));

app.use(session({
  secret: 'superman',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } 
}));

app.use(flash());
app.use((req, res, next) => {
  res.locals.error_msg = req.flash('error');
  next();
});

app.use(passport.initialize());
app.use(passport.session());

startCleanupJob();
app.use("/admin", adminRoutes);
app.use("/user", userRoutes);
app.use("/", userRoutes);

const PORT = process.env.PORT || 4001;

app.listen(PORT, () => {
  console.log(`Server running:${PORT}`);
});