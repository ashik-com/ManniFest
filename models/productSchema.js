const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
  baseprice:{type:Number,required:true},
  
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  isListed: { type: Boolean, default: true }, 
  variants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variant" }],

  specifications: {
    material: { type: String, default: "Not specified" },
    sleeveType: {
      type: String,
      enum: ["Full sleeve", "Half sleeve", "Sleeveless"],
  },
    fitType: { type: String, default: "Regular" },
    pattern: { type: String, default: "Plain",required:false }
  },

  offer: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", default: null },
  ratings:[{
    userId:{type:mongoose.Schema.Types.ObjectId,ref:"User"},
    rating:{type:Number,required:true,min:1,max:5},
    review:{type:String},
 } ],
 averageRating:{type:Number,default:0}
},{timestamps:true});

const Product = mongoose.model("Product",productSchema);
module.exports = Product
