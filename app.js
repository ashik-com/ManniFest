const express = require('express')
const mongoose = require('mongoose')
const env = require('dotenv').config();
const connectDB = require('./config/db');
const path = require('path')
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require('nodemailer')
const session = require('express-session');
const adminRoutes = require("./routes/adminRoutes");
const userRoutes = require('./routes/userRoutes')
const ejs = require('ejs');
const passport = require('passport');
const bcrypt = require("bcrypt");

connectDB();
const app = express()

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json());
app.use(cors());
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(express.static(path.join(__dirname, 'public')));
app.use("/uploads", express.static("uploads"));

app.use(session({
  secret: 'superman',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } 
}));

app.use(passport.initialize());
app.use(passport.session());


const PORT = process.env.PORT || 4001

app.use("/admin", adminRoutes);
app.use("/user",userRoutes);
app.use("/",userRoutes)


app.listen(PORT,()=>{
    console.log(`Server running:${PORT}`);
})