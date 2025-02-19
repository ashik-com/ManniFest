const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const categoryController = require("../controllers/categoryController")
const productController = require("../controllers/productController")
const dashboardController = require("../controllers/dashboardController")
const upload = require("../middlewares/multer")
const path = require('path')



// LOGIN ROUTES
router.route('/login')
    .get(adminController.getLoginPage)
    .post(adminController.postLogin)


// DASHBOARD ROUTES
router.route('/dashboard')
    .get(dashboardController.getDashboard)
    
// USERS ROUTES
router.route('/users')
    .get(adminController.getUser)

router.route("/users/block/:id")    
    .patch(adminController.blockUser)


//  CATEGORIES ROUTES  
router.route('/categorys')
    .get(categoryController.getCategorys) 


router.route("/softDeleteCategory/:id") 
    .patch(categoryController.softDeleteCategory)

router.route('/editCategory/:id')
    .patch(categoryController.editCategory)    

//ADD CATEGORIES 
router.route('/addcategorys')
    .get(categoryController.getAddCategorys)
    .post(categoryController.postAddCategory)    
 

//PRODUCTS ROUTES 
router.route('/products')
    .get(productController.getProducts)


router.route("/AddProduct")    
    .get(productController.getAddProduct)
    .post(upload,productController.postAddProduct);

router.route('/editproduct/:productId')
    .get(productController.editProduct)    
   

    

//OFFERS ROUTES 
router.route('/offers')
    .get(adminController.getOffers)    

    

// LOGOUT ROUTES
router.get("/logout", adminController.logout);






module.exports = router;
