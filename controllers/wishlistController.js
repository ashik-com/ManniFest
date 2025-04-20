const Cart = require("../models/cartSchema")
const Variant = require("../models/variantSchema")
const product = require("../models/productSchema")
const User = require("../models/userSchema")
const Wishlist = require("../models/wishlistSchema")


exports.addtowishlist = async (req, res) => {
  const { productId, variantId } = req.body;

  try {
      
      if (!req.session.email) {
          return res.json({ success: false, message: "User not logged in" });
      }

      const user = await User.findOne({ email: req.session.email });
      if (!user) {
          return res.json({ success: false, message: "User not found" });
      }
      const userId = user._id;

      
      const variant = await Variant.findById(variantId);
      if (!variant) {
          return res.json({ success: false, message: "Variant not found" });
      }

      
      let wishlist = await Wishlist.findOne({ userId });

      if (!wishlist) {
      
          wishlist = new Wishlist({ userId, items: [{ productId, variantId }] });
      } else {
      
          const itemExists = wishlist.items.some(item => 
              item.productId.toString() === productId && item.variantId.toString() === variantId
          );

          if (itemExists) {
              return res.json({ success: false, message: "Item already in wishlist" });
          }

          wishlist.items.push({ productId, variantId });
      }

      await wishlist.save();

      res.json({ success: true, wishlistCount: wishlist.items.length });
  } catch (error) {
      console.error("Error adding to wishlist:", error);
      res.json({ success: false, message: "Error adding to Wishlist" });
  }
};

  exports.getWishlist = async (req,res)=>{
    try {
      const name = req.session.name? req.session.name :""
      const user = await User.findOne({email:req.session.email})
      const userId = user._id

      const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: "items.productId",
        select: "name baseprice description",
      })
      .populate({
        path: "items.variantId",
        select: "color size price stock images",
      });

      
      res.render("user/wishlist",{name,wishlist})
    } catch (error) {
      
    }


  }


  exports.removeFromWishlist = async (req, res) => {
    const { itemId } = req.body; 

    try {
        if (!req.session.email) {
            return res.json({ success: false, message: "User not logged in" });
        }

        const user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.json({ success: false, message: "User not found" });
        }
        const userId = user._id;

        // Find the wishlist and remove the item
        const wishlist = await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { items: { _id: itemId } } }, // Removing based on `_id` of wishlist item
            { new: true }
        );

        if (!wishlist) {
            return res.json({ success: false, message: "Wishlist not found" });
        }

        res.json({ success: true, wishlistCount: wishlist.items.length });
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        res.json({ success: false, message: "Error removing from Wishlist" });
    }
};


exports.moveToCart = async (req, res) => {
  try {
    // Validate request body
    if (!req.body || !req.body.itemId) {
      return res.status(400).json({ 
        success: false, 
        message: "Item ID is required" 
      });
    }

    // Validate itemId format (assuming MongoDB ObjectId)
    const { itemId } = req.body;
    if (!itemId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid item ID format" 
      });
    }

    // Check if user session exists
    if (!req.session || !req.session.email) {
      return res.status(401).json({ 
        success: false, 
        message: "User not authenticated" 
      });
    }

    // Find user
    const user = await User.findOne({ email: req.session.email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }
    const userId = user._id;

    // Find user's wishlist
    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.status(404).json({ 
        success: false, 
        message: "Wishlist not found" 
      });
    }

    // Find the item in the wishlist
    const itemIndex = wishlist.items.findIndex((item) => item._id.toString() === itemId);
    if (itemIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: "Item not found in wishlist" 
      });
    }
    
    const item = wishlist.items[itemIndex];
    
    // Validate variant
    const variant = await Variant.findById(item.variantId);
    if (!variant) {
      return res.status(404).json({ 
        success: false, 
        message: "Product variant not found" 
      });
    }

    // Validate stock availability
    if (variant.stock <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Item is out of stock" 
      });
    }

    // Find or create user's cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Check existing quantity in cart
    const existingCartItemIndex = cart.items.findIndex(
      (cartItem) => cartItem.variantId.toString() === item.variantId.toString()
    );

    // Calculate total quantity (existing + new)
    let totalQuantity = 1; // Default for new item
    if (existingCartItemIndex !== -1) {
      totalQuantity = cart.items[existingCartItemIndex].quantity + 1;
    }

    // Validate against maximum quantity (assuming variant.maxQuantity exists)
    const maxQuantity = variant.maxQuantity || 10; // Default to 10 if not specified
    if (totalQuantity > maxQuantity) {
      return res.status(400).json({ 
        success: false, 
        message: `Maximum available quantity (${maxQuantity}) exceeded`,
        currentQuantity: existingCartItemIndex !== -1 ? cart.items[existingCartItemIndex].quantity : 0,
        maxQuantity: maxQuantity
      });
    }

    // Validate against stock
    if (totalQuantity > variant.stock) {
      return res.status(400).json({ 
        success: false, 
        message: `Requested quantity (${totalQuantity}) exceeds available stock (${variant.stock})`,
        availableStock: variant.stock
      });
    }

    // Remove item from wishlist
    wishlist.items.splice(itemIndex, 1);
    await wishlist.save();

    // Update cart
    if (existingCartItemIndex !== -1) {
      cart.items[existingCartItemIndex].quantity = totalQuantity;
    } else {
      cart.items.push({
        productId: item.productId,
        variantId: item.variantId,
        price: variant.price,
        quantity: 1,
      });
    }

    await cart.save();

    return res.status(200).json({ 
      success: true, 
      message: "Item moved to cart successfully",
      totalQuantity: totalQuantity
    });

  } catch (error) {
    console.error("Error moving item to cart:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};