const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true
    },
    country: { 
        type: String, 
        required: true, 
        default: "India" 
    },
    fullName: { type: String, required: true },
    mobileNumber: { 
        type: String, 
        required: true, 
        
    },
    pinCode: { 
        type: String, 
        required: true, 
        
    },
    city: { type: String, required: true },
    state: { type: String, required: true },
    addressLine1: { type: String, required: false }, 
    landmark: { type: String }, 
    addressType: { 
        type: String, 
        enum: ["Home", "Office", "Other"], 
        required: false
    },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

const Address = mongoose.model("Address", addressSchema);
module.exports = Address;
