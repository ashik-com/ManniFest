const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const Variant = require("../models/variantSchema")
const path = require('path')
const Offer = require("../models/offersSchema")
const cloudinary = require("../utils/cloudinary"); // Adjust the path to your Cloudinary config file
const fs = require("fs").promises;




exports.getProducts = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      let limit = 5;
      const searchQuery = req.query.search || "";

      const query = searchQuery
          ? { name: { $regex: searchQuery, $options: "i" } }
          : {};

      const totalProducts = await Product.countDocuments({});

      const totalPages = Math.ceil(totalProducts / limit);

      const products = await Product.find(query)
          .populate({
              path: 'variants',
              select: 'color size price stock images'
          })
          .populate({
              path: 'category',
              select: 'name'
          })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean();

      // Fetch offers for all products in the current page
      const productIds = products.map(product => product._id);
      const offers = await Offer.find({
          productId: { $in: productIds },
          isActive: true,
          endDate: { $gte: new Date() } // Only active offers that haven't expired
      }).lean();

      // Add hasOffer flag to each product
      products.forEach(product => {
          product.hasOffer = offers.some(offer => 
              offer.productId.toString() === product._id.toString()
          );
      });

      res.render('admin/products', { 
          products, 
          totalPages, 
          currentPage: page, 
          searchQuery 
      });
  } catch (error) {
      console.error('Error Fetching product:', error);
      res.status(500).send('server error');
  }
};



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
    const { meterial, sleeveType, fitType, pattern } = specifications;

    let images = req.files;
    let productImg = [];
    let variantImagesMap = {};

    console.log("Received files:", images);

    // Process and upload images to Cloudinary
    for (let item of images) {
      console.log("Processing file:", item.fieldname);

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(item.path, {
        folder: "products", // Optional: organize images in a folder on Cloudinary
        public_id: `${Date.now()}_${item.originalname.split(".")[0]}`, // Unique name
      });

      // Delete the temporary local file
      await fs.unlink(item.path);

      if (item.fieldname === "images") {
        productImg.push(result.secure_url); // Store Cloudinary URL
      } else {
        let match = item.fieldname.match(/^variant_images_(\d+)(\[\])?$/);
        if (match) {
          let variantIndex = parseInt(match[1], 10);
          if (!variantImagesMap[variantIndex]) {
            variantImagesMap[variantIndex] = [];
          }
          variantImagesMap[variantIndex].push(result.secure_url); // Store Cloudinary URL
        }
      }
    }

    console.log("Mapped Variant Images:", variantImagesMap);

    // Validation for minimum images (if still required)
    if (variantImagesMap.length < 3) {
      return res.status(400).json({ message: "At least 3 images are required" });
    }

    // Create new product
    const newProduct = new Product({
      name,
      description,
      category,
      baseprice: price,
      stock,
      images: productImg, // Use Cloudinary URLs directly
      specifications: { meterial, sleeveType, fitType, pattern },
    });

    const savedProduct = await newProduct.save();

    let variantIds = [];

    // Process variants
    for (let i = 0; i < variants.length; i++) {
      let item = typeof variants[i] === "string" ? JSON.parse(variants[i]) : variants[i]; // Handle if variants is a JSON string

      if (!item.color || !item.size || !item.price || !item.stock) {
        return res.status(400).json({ message: "All variant fields are required!" });
      }

      let variantImgPaths = variantImagesMap[i] || [];

      console.log(`Variant ${i} images before saving:`, variantImgPaths);

      const newVariant = new Variant({
        productId: savedProduct._id,
        color: item.color.trim(),
        size: item.size.trim(),
        price: item.price,
        stock: item.stock,
        images: variantImgPaths, // Use Cloudinary URLs
      });

      console.log("Saving Variant:", newVariant);

      const savedVariant = await newVariant.save();
      variantIds.push(savedVariant._id);
    }

    // Update product with variant IDs
    savedProduct.variants = variantIds;
    await savedProduct.save();

    return res.status(201).json({
      success: true,
      message: "Product added successfully!",
      product: savedProduct,
    });
  } catch (error) {
    console.error("Error adding product:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


exports.getEditProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);
        const variants = await Variant.find({ productId });
        const categories = await Category.find({ isListed: true })

        if (!product) {
            res.status(404).send("Product not found")
        }


        res.render('admin/editproduct', { product, categories, variants,productId })
    } catch (error) {
        console.log(error)
        res.status(500).send('Server error')

    }
}


exports.updateEditProduct = async (req, res) => {
    try {
      console.log("Request Body:", req.body);
      console.log("Request Files:", req.files);
  
      const { name, description, category, price, stock, variants, isListed, status, specifications } = req.body;
      const productId = req.params.id;
  
      if (!productId || !name || !description || !category || !price) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }
  
      let product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
  
      product.name = name;
      product.description = description;
      product.category = category;
      product.price = price;
      product.stock = stock;
      product.isListed = isListed === "true";
      product.status = status;
      product.specifications = specifications || {};
  
      await product.save();
  
    
      if (variants && Array.isArray(variants)) {
        for (let index = 0; index < variants.length; index++) {
          const variant = variants[index];
          const existingVariant = await Variant.findOne({
            productId,
            color: variant.color,
            size: variant.size,
          });
  
          let variantImages = existingVariant ? existingVariant.images : [];
  
         
          const newImages = req.files.filter(file => file.fieldname === `variant_images_${index}[]`);
          if (newImages.length > 0) {
            variantImages.push(...newImages.map(file => file.filename));
          }
  
         
          const removedImages = req.body[`removed_images_${index}[]`] || [];
          if (Array.isArray(removedImages)) {
            variantImages = variantImages.filter(img => !removedImages.includes(img));
            removedImages.forEach((image) => {
              const imagePath = path.join(__dirname, "../public/uploads/products", image);
              if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            });
          }
  
          if (existingVariant) {
          
            existingVariant.price = variant.price;
            existingVariant.stock = variant.stock;
            
            await existingVariant.save();
          } else {
            
            await Variant.create({
              productId,
              color: variant.color,
              size: variant.size,
              price: variant.price,
              stock: variant.stock,
              // images: variantImages,
            });
          }
        }
      }
  
      res.json({ success: true, message: "Product updated successfully!" });
    } catch (error) {
      console.error("Update Error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };



    exports.deleteProduct = async (req, res) => {
        try {
          const product = await Product.findById(req.params.id);
      
          if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
          }
      
          product.isListed = !product.isListed;
          await product.save();
      
          res.json({
            success: true,
            isListed: product.isListed,
            message: product.isListed
              ? " Product restored successfully."
              : " Product hidden successfully.",
          });
        } catch (error) {
          console.error("Error in deleteProduct:", error); 
          res.status(500).json({ success: false, message: "Server error occurred", error: error.message });
        }
      };
      