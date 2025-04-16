const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const Variant = require("../models/variantSchema")
const bcrypt = require("bcrypt");
const Offer = require("../models/offersSchema")


exports.getCategorys = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10; 
      const searchQuery = req.query.search || '';
      const skip = (page - 1) * limit;

      const query = searchQuery
          ? { name: { $regex: searchQuery, $options: 'i' } }
          : {};

      const totalCategories = await Category.countDocuments(query);
      const categories = await Category.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();
      const categoryIds = categories.map(c => c._id);
      const offers = await Offer.find({ type: 'category', categoryId: { $in: categoryIds } }).lean();
      const offerMap = {};
      offers.forEach(offer => {
          offerMap[offer.categoryId.toString()] = offer;
      });
      const enrichedCategories = categories.map(category => ({
          ...category,
          offer: offerMap[category._id.toString()] || null,
      }));

      res.render('admin/categorys', {
          categorys: enrichedCategories, 
          currentPage: page,
          totalPages: Math.ceil(totalCategories / limit),
          searchQuery: searchQuery,
      });
  } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).render('admin/catgorys', {
          categorys: [],
          currentPage: 1,
          totalPages: 1,
          searchQuery: '',
          error: 'Failed to load categories',
      });
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
      const existingCategory = await Category.findOne({
        name: { $regex: `^${name}$`, $options: "i" },
        _id: { $ne: categoryId }, 
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
  