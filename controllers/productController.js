const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const Variant = require("../models/variantSchema")
const path = require('path')
const Offer = require("../models/offersSchema")
const cloudinary = require("../utils/cloudinary"); // Adjust the path to your Cloudinary config file
const fs = require("fs").promises;
const mongoose = require('mongoose')




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

    

    // Process and upload images to Cloudinary
    for (let item of images) {
      

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

      

      const newVariant = new Variant({
        productId: savedProduct._id,
        color: item.color.trim(),
        size: item.size.trim(),
        price: item.price,
        stock: item.stock,
        images: variantImgPaths, // Use Cloudinary URLs
      });

      

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

        console.log("variants",variants)
        res.render('admin/editproduct', { product, categories, variants,productId })
    } catch (error) {
        console.log(error)
        res.status(500).send('Server error')

    }
}


exports.updateEditProduct = async (req, res) => {
  try {
    const { name, description, category, price, isListed, status, variants } = req.body;
    const productId = req.params.id;

    // Validate required fields
    if (!productId || !name || !description || !category || !price) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    const basePrice = parseFloat(price);
    if (isNaN(basePrice) || basePrice <= 0) {
      return res.status(400).json({ success: false, message: "Base price must be positive" });
    }

    // Debug: Log req.files
    console.log("Uploaded files:", req.files);

    // Find product
    let product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Update product fields
    product.name = name;
    product.description = description;
    product.category = category;
    product.baseprice = basePrice;
    product.isListed = isListed === "true";
    product.status = status;

    // Update specifications
    product.specifications = {
      material: req.body["specifications[material]"] || product.specifications.material || "Not specified",
      sleeveType: req.body["specifications[sleeveType]"] || product.specifications.sleeveType,
      fitType: req.body["specifications[fitType]"] || product.specifications.fitType || "Regular",
      pattern: req.body["specifications[pattern]"] || product.specifications.pattern || "Plain",
    };

    // Validate sleeveType
    const validSleeveTypes = ["Full sleeve", "Half sleeve", "Sleeveless"];
    if (!product.specifications.sleeveType || !validSleeveTypes.includes(product.specifications.sleeveType)) {
      return res.status(400).json({ success: false, message: "Invalid or missing sleeveType. Must be one of: Full sleeve, Half sleeve, Sleeveless" });
    }

    // Debug: Log specifications
    console.log("Updated Specifications:", product.specifications);

    // Handle variants
    if (variants) {
      const variantArray = Array.isArray(variants) ? variants : Object.values(variants);
      for (let index = 0; index < variantArray.length; index++) {
        const variant = variantArray[index];
        if (!variant.color || !variant.size || !variant.price || !variant.stock) {
          return res.status(400).json({ success: false, message: `Missing fields for variant ${index + 1}` });
        }
        const variantPrice = parseFloat(variant.price);
        const variantStock = parseInt(variant.stock);
        if (variantPrice <= 0 || variantStock < 0) {
          return res.status(400).json({ success: false, message: `Invalid price or stock for variant ${index + 1}` });
        }

        const existingVariant = variant.id
          ? await Variant.findOne({ _id: variant.id, productId })
          : await Variant.findOne({ productId, color: variant.color, size: variant.size });

        let variantImages = existingVariant ? existingVariant.images : [];

        // Handle new images
        const newImages = req.files.filter(file => file.fieldname === `variant_images[${index}][]`);
        if (newImages.length > 0) {
          const validTypes = ["image/jpeg", "image/png"];
          for (const file of newImages) {
            if (!validTypes.includes(file.mimetype)) {
              return res.status(400).json({ success: false, message: "Only JPEG/PNG images allowed" });
            }
            // Upload to Cloudinary
            try {
              const uploadOptions = {
                folder: "products",
                public_id: `${Date.now()}_${file.originalname.split(".")[0]}`,
              };
              let result;
              if (file.path) {
                // Disk storage: upload from file path
                result = await cloudinary.uploader.upload(file.path, uploadOptions);
                // Delete local file
                await fs.unlink(file.path).catch(err => console.error("Error deleting local file:", err));
              } else if (file.buffer) {
                // Memory storage: upload from buffer
                result = await new Promise((resolve, reject) => {
                  const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                  });
                  stream.end(file.buffer);
                });
              } else {
                throw new Error("File missing path or buffer");
              }
              variantImages.push(result.secure_url);
              console.log("Uploaded image URL:", result.secure_url);
            } catch (uploadError) {
              console.error("Cloudinary upload error:", uploadError);
              return res.status(500).json({ success: false, message: "Failed to upload image to Cloudinary" });
            }
          }
        }

        // Handle removed images
        let removedImages = [];
        if (req.body[`removed_images[${index}]`]) {
          removedImages = JSON.parse(req.body[`removed_images[${index}]`]);
          if (Array.isArray(removedImages)) {
            for (const image of removedImages) {
              if (variantImages.includes(image)) {
                try {
                  // Extract public_id from Cloudinary URL
                  const publicId = image.split("/").slice(-1)[0].split(".")[0];
                  await cloudinary.uploader.destroy(`products/${publicId}`);
                } catch (deleteError) {
                  console.error("Cloudinary delete error:", deleteError);
                }
              }
            }
            variantImages = variantImages.filter(img => !removedImages.includes(img));
          }
        }

        if (existingVariant) {
          existingVariant.price = variantPrice;
          existingVariant.stock = variantStock;
          existingVariant.images = variantImages;
          await existingVariant.save();
        } else {
          const newVariant = await Variant.create({
            productId,
            color: variant.color.trim(),
            size: variant.size.trim(),
            price: variantPrice,
            stock: variantStock,
            images: variantImages,
          });
          product.variants.push(newVariant._id);
        }
      }
    }

    // Handle removed variants
    const removedVariants = req.body.removed_variants ? JSON.parse(req.body.removed_variants) : [];
    if (removedVariants.length > 0) {
      const validObjectIds = removedVariants.filter(id => mongoose.isValidObjectId(id));
      if (validObjectIds.length === 0) {
        return res.status(400).json({ success: false, message: "No valid variant IDs provided for deletion" });
      }
      // Delete variant images from Cloudinary
      const variantsToDelete = await Variant.find({ _id: { $in: validObjectIds }, productId });
      for (const variant of variantsToDelete) {
        for (const image of variant.images) {
          try {
            const publicId = image.split("/").slice(-1)[0].split(".")[0];
            await cloudinary.uploader.destroy(`products/${publicId}`);
          } catch (deleteError) {
            console.error("Cloudinary delete error:", deleteError);
          }
        }
      }
      await Variant.deleteMany({ productId, _id: { $in: validObjectIds } });
      product.variants = product.variants.filter(variantId => !validObjectIds.includes(variantId.toString()));
    }

    await product.save();

    // Debug: Log saved product
    const savedProduct = await Product.findById(productId).populate("variants");
    console.log("Product after save:", savedProduct);

    res.json({ success: true, message: "Product updated successfully!" });
  } catch (error) {
    console.error("Update Error:", error);
    if (error.name === "CastError") {
      return res.status(400).json({ success: false, message: "Invalid variant ID format" });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: `Validation error: ${error.message}` });
    }
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
      