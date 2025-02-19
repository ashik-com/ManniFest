const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const Variant = require("../models/variantSchema")
const bcrypt = require("bcrypt");




exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({})
        .populate({
            path: 'variants',
            select: 'color size price stock' 
        })
        .populate({
            path: 'category',
            select: 'name' 
        })
        .lean();
        res.render('admin/products',{products})
    } catch (error) {
        console.error('Error Fetching product:',error)
        res.send(500).send('server error')
        
    }
   
}



exports.getAddProduct = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true })
        res.render('admin/addproduct', { categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).send('Internal Server Error');
    }
};



exports.postAddProduct = async (req, res) => {
    try {
        const { name, description, category, specifications, variants, price, stock } = req.body;
        const { meterial, sleeveType, fitType, pattern } = specifications
        console.log(stock)

        let images = req.files
        
        let productImg = []
        let variantImg = []

        for (let item of images) {
            if (item.fieldname === "images" && item.originalname.startsWith("cropped")) {
                productImg.push(item.path)
            } else if (item.fieldname.startsWith("variant")) {
                variantImg.push(item.path)
            }
        }


        const productsImg =productImg.map((fullPath)=>{
            const productsImg ='/'+ fullPath.split('public\\')[1].replace(/\\/g, '/');
            return productsImg;

        })
        const variantsImg =variantImg.map((fullPath)=>{
            const variantsImg ='/'+ fullPath.split('public\\')[1].replace(/\\/g, '/');
            return variantsImg;

        })


        if (!req.files || req.files.length < 3) {
            return res.status(400).json({ message: "At least 3 images are required" });
        }


        const newProduct = new Product({
            name,
            description,
            category,
            price,
            stock,
            images: productsImg,
            specifications: {
                meterial,
                sleeveType,
                fitType,
                pattern
            }

        });
        console.log("this is new product:", newProduct)

        const savedProduct = await newProduct.save();



        console.log(variants)

        let variantIds = [];
        for (let item of variants) {
            if (!item.color || !item.size || !item.price || !item.stock) {
                let missingFields=[]
                if (!item.color) missingFields.push("color");
                if (!item.size) missingFields.push("size");
                if (!item.price) missingFields.push("price");
                if (!item.stock) missingFields.push("stock");
                console.log(missingFields)
                return res.status(400).json({ message: "All variant fields are required!" });
            }

            const newVariant = new Variant({
                productId: savedProduct._id,
                color: item.color.trim(),
                size: item.size.trim(),
                price: item.price,
                stock: item.stock,
                images: variantsImg
            });

            console.log("this is new variant:", newVariant);
            const savedVariant = await newVariant.save();
            variantIds.push(savedVariant._id);
        }

        savedProduct.variants = variantIds;
        await savedProduct.save();

        return res.status(201).json({ success:true, message:"Product added successfully!", product: savedProduct });

    } catch (error) {
        console.error("Error adding product:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};



exports.editProduct = async (req,res)=>{
    try {
        const productId = req.params.productId; 
        console.log(productId)
        const product = await Product.findById(productId).populate('category'); // Find product & populate category
        const categories = await Category.find(); // Fetch all categories

        if (!product) {
            return res.status(404).send("Product not found");
        }

        res.render("admin/editproduct", { product, categories }); // Pass data to view
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).send("Server error")
    }
}