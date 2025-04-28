const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const categoryController = require("../controllers/categoryController")
const productController = require("../controllers/productController")
const dashboardController = require("../controllers/dashboardController")
const upload = require("../middlewares/multer")
const {isAdmin,checkLoged} = require('../middlewares/auth-middleware')
const path = require('path')
const couponsController = require("../controllers/couponsController")
const profile = require("../middlewares/multerForProfile")
const offerController = require("../controllers/offerController")
const salesController = require("../controllers/salesController")



// LOGIN ROUTES
router.route('/login')
    .get(checkLoged,adminController.getLoginPage)
    .post(adminController.postLogin)


// DASHBOARD ROUTES
router.route('/dashboard')
    .get(isAdmin,dashboardController.getDashboard)
    
// USERS ROUTES
router.route('/users')
    .get(isAdmin,adminController.getUser)

router.route("/users/block/:userId")    
    .patch(adminController.blockUser)


//  CATEGORIES ROUTES  
router.route('/categorys')
    .get(isAdmin,categoryController.getCategorys) 


router.route("/softDeleteCategory/:id") 
    .patch(categoryController.softDeleteCategory)

router.route('/editCategory/:id')
    .patch(categoryController.editCategory)    

//ADD CATEGORIES 
router.route('/addcategorys')
    .get(isAdmin,categoryController.getAddCategorys)
    .post(categoryController.postAddCategory)    
 

//PRODUCTS ROUTES 
router.route('/products')
    .get(isAdmin,productController.getProducts)


router.route("/addProduct")    
    .get(isAdmin,productController.getAddProduct)
    .post(upload,productController.postAddProduct);

router.route("/coupons")
    .get(isAdmin,couponsController.getCoupon)

router.route("/deletecoupon/:id")    
    .delete(couponsController.deleteCoupon)


router.route("/addCoupon")
    .get(isAdmin,couponsController.getAddCoupons) 
    .post(profile,couponsController.postAddCoupon)   
    
router.route('/productdelete/:id')
    .patch(productController.deleteProduct)    
   
router.route('/edit-Product/:id?')
    .get(productController.getEditProduct)
    .post(upload,productController.updateEditProduct)
    

//OFFERS ROUTES 
router.route('/offers')
    .get(isAdmin,offerController.getOffer)   
    
router.route("/addcategoryoffer/:id")
    .get(isAdmin,offerController.getAddOffer)
       
router.route("/addcategoryoffer")
    .post(offerController.addOffer)
router.route("/addproductoffer/:id")
    .get(offerController.getAddProductOffer)

router.route("/add-product-offer")
    .post(offerController.addOffer)

router.route("/edit-category-offer/:id")
    .get(isAdmin,offerController.editCategoryOffer)    
router.route("/update-offer/:id")
    .post(offerController.updateCategoryOffer)

//Order Management
router.route("/orders")
    .get(isAdmin,adminController.getOrders)

router.route("/order-details/:orderId/")  
    .get(isAdmin,adminController.orderDetails)

router.route("/update-order-status/:orderId")
    .patch(adminController.updateStatus)  
    
router.route("/approve-return-item/:orderId/:itemIndex")
    .post(adminController.approveReturn) 
    
router.route("/sales-report")
    .get(salesController.getSalesReport)  

router.route("/sales-report/download")
    .get(salesController. downloadSalesReport)
router.route("/wallet-transaction")
    .get(adminController.walletTransaction)

router.route("/ledger")
    .get(adminController.getLedger)


router.route("/editproductoffer/:productId")   
    .get(offerController.getEditProductOffer)
    .patch(offerController.updateProductOffer)
    .post(offerController.deleteProductOffer)

router.route('/delete-offer/:offerId')
    .post(offerController.deleteCategoryOffer)
router.route('/logout')
    .post(adminController.logout)



module.exports = router;
