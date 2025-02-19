const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const Variant = require("../models/variantSchema")
const bcrypt = require("bcrypt");


exports.getCategorys = async (req, res) => {
    try {
      const categorys = await Category.find({}) 
        .sort({ createdAt: -1 }); 
  
      res.render("admin/categorys", { categorys });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).send("Server error");
    }
  };

  exports.softDeleteCategory = async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
  
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
  
      category.isListed = !category.isListed; 
      await category.save();
  
      res.json({
        success: true,
        isListed: category.isListed,
        message: category.isListed
          ? "Category restored successfully."
          : "Category hidden successfully.",
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  };


  exports.editCategory = async (req, res) => {
    try {
      const { name, description } = req.body;
      const categoryId = req.params.id;
  
      const existingCategory = await Category.findOne({
        name: { $regex: `^${name}$`, $options: "i" },
        _id: { $ne: categoryId }, 
      });
  
      if (existingCategory) {
        return res.status(400).json({ message: "Category name already exists!" });
      }
  
      // Update the category
      const updatedCategory = await Category.findByIdAndUpdate(
        categoryId,
        { name, description },
        { new: true }
      );
  
      res.json({ success: true, updatedCategory });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error!" });
    }
  };
  



  exports.getAddCategorys =(req,res)=>{
    res.render('admin/addcategorys')
  }
  

  exports.postAddCategory = async (req, res) => {
    try {
      const { name, description } = req.body;
      const categoryId = req.params.id;
      console.log(name)
  
      if (!name) return res.status(400).json({ message: "Category name is required" });
  
      // Check if another category (excluding the current one) already exists with the same name
      const existingCategory = await Category.findOne({
        name: { $regex: `^${name}$`, $options: "i" },
        _id: { $ne: categoryId }, // Exclude current category
      });
  
      if (existingCategory) {
        return res.status(400).json({ message: "Category already exists!" });
      }
  
      const newCategory = new Category({ name, description });
      await newCategory.save();
  
      res.json({ success: true, message: "Category updated successfully" });
    } catch (error) {
      console.error("Error editing category:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  };
  