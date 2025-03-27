
const passport = require('passport');
const mongoose = require("mongoose");
const User = require('../models/userSchema')

exports.isLoged = (req,res,next)=>{
    if(req.session.name){
      
        res.redirect('/');

    }
    
    next()
}

exports.isAdmin = (req,res,next)=>{
  if(!req.session.adminId){
    return res.redirect("/admin/login");
  }
  next()
}

exports.checkLoged = (req,res,next)=>{
  if(req.session.adminId){
    return res.redirect('/admin/dashboard')
  }
  next()
}


exports.isBan = async (req,res,next)=>{

try {
  const email = req.session.email;
  const user= await User.find({email})
  

  if(user[0]?.isBlocked){
    req.session.destroy()
    next()
  }else{
    next()
  }
  
} catch (error) {
  console.error(error)
}

}





exports.handleGoogleAuthError = (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('Google Auth Error:', err);
      return res.redirect('/user/login');
    }
    if (!user) {
      
      return res.redirect('/user/login');
    }

    
    req.user = user;
    next();
  })(req, res, next);
};





 

exports.validateId = (req, res, next) => {
    const { id } = req.params; 

   
    if (!id) {
        return res.status(400).render("user/404error");
    }

   
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).render("user/404error");
    }

    next(); 
};


exports.isAuth = (req,res,next)=>{
  const name = req.session.name ? req.session.name : ""
  if(!name){
    res.redirect("/user/login")
  }
  next()
  

}