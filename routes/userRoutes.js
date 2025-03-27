const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const {isLoged,isBan,validateId,isAuth} = require('../middlewares/auth-middleware');
const {handleGoogleAuthError}= require('../middlewares/auth-middleware')
const googleAuthController = require('../controllers/googleAuthController');
const cartController = require("../controllers/cartController")
const upload = require("../middlewares/multer")
const profileController = require("../controllers/profileController")
const profile = require("../middlewares/multerForProfile")
const wishlistController = require("../controllers/wishlistController")
const checkoutController = require("../controllers/checkoutController")
const walletController = require("../controllers/walletController")
const couponsController = require("../controllers/couponsController")


// USER LOGIN
router.route('/login')
    .get(isLoged,userController.getLoginPage)
    .post(userController.postLogin)

   

router.route('/verification')  
    .get(isLoged,userController.getVerification)


router.route('/sent-otp')
    .post(userController.sentOtp)   
    
    
router.route('/verify-otp')    
    .post(userController.verifyOtp)



//GOOGLE AUTH

router.route('/auth/google')
    .get(isLoged,googleAuthController.redirectToGoogle)


router.route('/auth/google/callback')
    .get(isLoged,handleGoogleAuthError,googleAuthController.handleGoogleCallback)    
// FORGOT PASSWORD

router.route('/forgot-password')
    .get(isLoged,userController.getforgot)

router.route('/sentOtp-forgot')
    .post(userController.forgotOtp) 
    
router.route('/verify-forgot')    
    .post(userController.verifyForgot)

router.route('/reset-password')
    .get(isLoged,userController.getResetpassword)
    .post(userController.postReset)



router.route('/get-update')   
    .get(userController.getUpdate)

// USER SIGNUP

router.route('/signup')
    .get(isLoged,userController.getSignup)
    .post(userController.postSignup)


// profile

router.route("/profile")
    .get(isAuth,isBan,profileController.getProfile)
    
router.route("/addresses")
    .get(isAuth,isBan,profileController.addresses)    

router.route("/add-address")
    .post(isAuth,upload,profileController.addAddress)

router.route("/delete-address/:id")
    .delete(isAuth,profileController.deleteAddress)    


router.route("/edit-profile")
    .get(isAuth,isBan, profileController.getSingleProfile)


router.route("/send-email-otp")
    .post(isAuth,profileController.sendemailotp)

router.route("/verify-email-otp") 
    .post(isAuth, profileController.verifyemailotp)


router.route("/update-picture")
    .post(isAuth,profile,profileController.updatepicture)


router.route("/change-password")
    .post(isAuth, profileController.changepassword)


router.route("/send-otp")
    .post(isAuth,profileController.sendotp)


router.route("/reset-otp")
    .post(isAuth,profileController.resetotp)    


// HOME
router.route("/")
    .get(isBan,userController.getHome)



//SHOP

router.route('/shop')
    .get(isBan,userController.getShop)



//SINGLE PRODUCT DETAILS

router.route('/product-details/:id/:color?')
    .get(validateId,isBan,userController.getProductDetails)


//Cart Page

router.route("/cart")
    .get(isAuth,cartController.getCart)

router.route("/add-to-cart")
    .post(cartController.addToCart)    


router.route("/update-cart")
    .post(isAuth,cartController.updateCart)


router.route("/remove-from-cart")    
    .post(isAuth,cartController.removeFromCart)



// Wishlist

router.route("/add-to-wishlist")
    .post(isAuth,wishlistController.addtowishlist)

router.route("/wishlist")
    .get(isAuth,wishlistController.getWishlist)

router.route("/remove-from-wishlist")
    .post(isAuth,wishlistController.removeFromWishlist)    

router.route("/move-to-cart")
    .post(isAuth,wishlistController.moveToCart)
//ERROR PAGE

router.route('/error')
    .get(userController.error)
    


router.route("/checkout")
    .get(isAuth,checkoutController.getCheckout)
    .post(isAuth,checkoutController.postCheckout)


router.route("/checkout/wallet")  
    .post(walletController.payWithWallet)

router.route("/create-razorpay-order")
    .post(checkoutController.createRazorpayOrder)

router.route("/verify-razorpay-payment")
    .post(checkoutController.verifyRazorpayPayment)

router.route("/check-pending-razorpay")
    .get(isAuth,isBan,checkoutController.checkPendingRazorpay)
    
router.route("/retry-razorpay-payment")
    .post(checkoutController.retryRazorpayPayment)    

router.route("/order-success")
    .get(isAuth,checkoutController.orderSuccess)

router.route("/order-failure")    
    .get(isAuth,checkoutController.orderfailed)


router.route("/orders")
    .get(isAuth,profileController.myOrders)   
    
    
router.route("/order-details/:orderId")  
    .get(isAuth,profileController.orderDetails)

router.route("/cancel-order/:orderId")
    .post(profileController.cancelOrder)

router.route("/cancel-order-item/:orderId/:itemIndex")
    .post(profileController.cancelOrderItem)

router.route("/request-return-item/:orderId/:itemIndex")
    .post(profileController.returnRequest)    


router.route("/wallet")
    .get(walletController.getWallet)

router.route('/wallet/create')
    .post(walletController.createWallet)    


router.route("/wallet/verify-payment")
    .post(walletController.verifyWalletPayment) 
    
    
router.route("/wallet/balance")
    .get(walletController.getBalance) 
    
router.route("/validate-coupon") 
    .get(isAuth,couponsController.validateCoupon)

router.route("/download-invoice/:orderId")   
    .get(profileController.downloadInvoice)


router.route('/logout')
    .post(userController.logout)


router.route("*")
    .get(userController.error)

module.exports = router;