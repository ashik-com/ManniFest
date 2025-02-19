const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const {isLoged} = require('../middlewares/auth-middleware');
const {handleGoogleAuthError}= require('../middlewares/auth-middleware')
const googleAuthController = require('../controllers/googleAuthController');

// USER LOGIN
router.route('/login')
    .get(userController.getLoginPage)
    .post(userController.postLogin)

   

router.route('/verification')  
    .get(userController.getVerification)


router.route('/sent-otp')
    .post(userController.sentOtp)   
    
    
router.route('/verify-otp')    
    .post(userController.verifyOtp)



//GOOGLE AUTH

router.route('/auth/google')
    .get(googleAuthController.redirectToGoogle)


router.route('/auth/google/callback')
    .get(handleGoogleAuthError,googleAuthController.handleGoogleCallback)    
// FORGOT PASSWORD

router.route('/forgot-password')
    .get(userController.getforgot)

router.route('/sentOtp-forgot')
    .post(userController.forgotOtp) 
    
router.route('/verify-forgot')    
    .post(userController.verifyForgot)

router.route('/reset-password')
    .get(userController.getResetpassword)
    .post(userController.postReset)



router.route('/get-update')   
    .get(userController.getUpdate)

// USER SIGNUP

router.route('/signup')
    .get(userController.getSignup)
    .post(userController.postSignup)

   


// HOME
router.route("/")
    .get(userController.getHome)



//SHOP

router.route('/shop')
    .get(userController.getShop)



//SINGLE PRODUCT DETAILS

router.route('/product-details/:id')
    .get(userController.getProductDetails)

//ERROR PAGE

router.route('/error')
    .get(userController.error)
    

// LOGOUT

router.route('/logout')
    .post(userController.logout)




module.exports = router;