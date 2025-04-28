const { localsName } = require("ejs")
const User = require("../models/userSchema")
const Address = require("../models/addressSchema")
const nodemailer = require("nodemailer");
require("dotenv").config();
const otpGenerator = require("otp-generator");
const Order = require("../models/orderSchema")
const Variant = require("../models/variantSchema")
const Wallet = require("../models/walletSchema")
const bcrypt = require("bcrypt");
const Coupon = require("../models/couponSchema");
const PDFDocument = require('pdfkit');
const WalletTransaction = require("../models/walletTransactionSchema")
const { v4: uuidv4 } = require('uuid');
let otpStorage = {};

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
});




exports.getProfile = async (req, res) => {

    try {
        const name = req.session.name ? req.session.name : ""
        const email = req.session.email
        const user = await User.findOne({ email: email })
        if (req.xhr) {
            return res.render("user/partials/overview", { name, user });
        }
        res.render("user/profile", { name, user })
    } catch (error) {

    }
}

exports.addresses = async (req, res) => {

    const name = req.session.name ? req.session.name : ""
    const email = req.session.email
    const user = await User.findOne({ email: email })
    const addresses = await Address.find({ userId: user._id })
    if (req.xhr) {
        return res.render("user/partials/addresses", { name, user, addresses });
    }



}


exports.addAddress = async (req, res) => {
    try {



        const userId = await User.findOne({ email: req.session.email })
        const { fullName, mobileNumber, pinCode, city, state, addressLine1, landmark, addressType, isDefault, country } = req.body;
        // Save the new address
        const newAddress = new Address({
            userId: userId, // Assuming session-based authentication
            fullName,
            mobileNumber,
            pinCode,
            city,
            state,
            addressLine1,
            landmark,
            addressType,
            isDefault,
            country
        });

        await newAddress.save();
        const addresses = await Address.find({ userId:userId.id })
        return res.json({ success: true, message: "Address added successfully!", addresses });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error. Please try again." });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedAddress = await Address.findByIdAndDelete(id);

        if (!deletedAddress) {
            return res.status(404).json({ success: false, message: "Address not found" });
        }

        // Fetch updated addresses after deletion
        const updatedAddresses = await Address.find({ userId: deletedAddress.userId });

        res.json({ success: true, addresses: updatedAddresses });
    } catch (error) {
        console.error("Error deleting address:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};


exports.getSingleProfile = async (req, res) => {

    try {
        const name = req.session.name ? req.session.name : ""
        const user = await User.findOne({ email: req.session.email })

        if (req.xhr) {
            return res.render("user/partials/myProfile", { name, user });
        }
    } catch (error) {

    }

}


exports.sendemailotp = async (req, res) => {
    const { email } = req.body;


    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.json({ success: false, message: "Email is already in use." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage[email] = otp;


    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "OTP for Email Change",
        text: `Your OTP is: ${otp}. It is valid for 5 minutes.`
    };

    transporter.sendMail(mailOptions, (error) => {
        if (error) {
            return res.json({ success: false, message: "Error sending OTP." });
        }
        res.json({ success: true, message: "OTP sent successfully!" });
    });
};


exports.verifyemailotp = async (req, res) => {
    const { email, otp } = req.body;


    const user = await User.findOne({ email: req.session.email });

    if (!user) {
        return res.json({ success: false, message: "User not found!" });
    }


    if (!otpStorage[email] || otpStorage[email] !== parseInt(otp)) {
        return res.json({ success: false, message: "Invalid OTP." });
    }


    await User.findByIdAndUpdate(user._id, { email });

   


    delete otpStorage[email];

    req.session.email = email;

    return res.json({ success: true, message: "Email updated successfully!" });
};



exports.updatepicture = async (req, res) => {
    try {
       

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const imageUrl = `/uploads/profile_pictures/${req.file.filename}`;

        // Find user by session email
        const user = await User.findOne({ email: req.session.email });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Update profile picture
        user.profileImage = imageUrl;
        await user.save();

        res.json({ success: true, imageUrl });
    } catch (error) {
        console.error("Error uploading profile picture:", error);
        res.status(500).json({ success: false, message: "Something " });
    }
};


exports.changepassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findOne({ email: req.session.email });
       

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) return res.status(400).json({ success: false, message: "Incorrect current password" });

        user.password_hash = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};


exports.sendotp = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }


        const otp = otpGenerator.generate(6, {
            digits: true,
            upperCaseAlphabets: false,
            specialChars: false,
            lowerCaseAlphabets: false
        });
        user.otp = otp;
        user.otpExpires = Date.now() + 5 * 60 * 1000;
        await user.save();


        const transporter = nodemailer.createTransport({
            service: "Gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your Password Reset OTP",
            text: `Your OTP for password reset is: ${otp}. This OTP is valid for 5 minutes.`,
        };

        await transporter.sendMail(mailOptions);

        res.json({ success: true, message: "OTP sent successfully!" });

    } catch (error) {
        console.error("Error sending OTP:", error);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};


exports.resetotp = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ email });


        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Check if OTP is valid
        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
        }

        // Hash new password and save
        user.password_hash = await bcrypt.hash(newPassword, 10);
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({ success: true, message: "Password updated successfully!" });

    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ success: false, message: "Something went wrong" });
    }
};



exports.myOrders = async (req, res) => {
    try {
        if (!req.session || !req.session.email) {
            return res.redirect('/user/login');
        }

        const user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.redirect('/user/login');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ userId: user._id });
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({ userId: user._id })
            .sort({ placedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.render('user/orders', {
            name: req.session.name || 'Guest',
            orders,
            currentPage: page,
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages
        });
    } catch (error) {
        console.error("Error fetching orders:", error);
        res.status(500).send("Server error");
    }
};


exports.orderDetails = async (req, res) => {
    try {
        if (!req.session || !req.session.email) {
            return res.redirect('/user/login');
        }

        const user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.redirect('/user/login');
        }

        const order = await Order.findOne({ _id: req.params.orderId, userId: user._id }).lean();
        if (!order) {
            return res.status(404).send("Order not found");
        }

        res.render('user/order-details', {
            name: req.session.name || 'Guest',
            order
        });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send("Server error");
    }
};

exports.cancelOrder = async (req, res) => {
    try {
        if (!req.session || !req.session.email) {
            return res.status(401).json({ success: false, message: "Please log in" });
        }

        const user = await User.findOne({ email: req.session.email });
        const order = await Order.findOne({ _id: req.params.orderId, userId: user._id });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.orderStatus !== 'Pending' && order.orderStatus !== 'Shipped') {
            return res.status(400).json({ success: false, message: "Cannot cancel this order" });
        }

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            for (const item of order.items) {
                if (!item.cancelled) {
                    const variant = await Variant.findById(item.variantId).session(session);
                    if (!variant) {
                        throw new Error(`Variant not found for item: ${item.productName}`);
                    }
                   
                    await Variant.updateOne(
                        { _id: item.variantId },
                        { $inc: { stock: item.quantity } },
                        { session }
                    );
                    item.cancelled = true;
                }
            }
          

            order.orderStatus = 'Cancelled';
            order.paymentStatus = 'Failed';
            order.totalPrice = 0; // All items cancelled, so total is 0
            await order.save({ session });

            await session.commitTransaction();
            
            res.json({ success: true, message: "All products cancelled successfully" });
        } catch (error) {
            await session.abortTransaction();
            console.error("Error cancelling order:", error);
            return res.status(500).json({ success: false, message: `Cancellation failed: ${error.message}` });
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

exports.returnRequest = async (req, res) => {
    try {
        const { orderId, itemIndex } = req.params;
        const { reason } = req.body; // Get reason from request body
        const user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const userId = user._id;
        const order = await Order.findOne({ _id: orderId, userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.orderStatus !== "Delivered") {
            return res.status(400).json({ success: false, message: "Returns can only be requested for delivered orders" });
        }

        const item = order.items[itemIndex];
        if (!item || item.cancelled || item.returnRequested || item.returned) {
            return res.status(400).json({ success: false, message: "Item not found, already cancelled, or return already requested/completed" });
        }

        // Check if reason is provided
        if (!reason || reason.trim() === "") {
            return res.status(400).json({ success: false, message: "Return reason is required" });
        }

        // Mark item as return requested
        item.returnRequested = true;
        item.returnRequestedAt = new Date();
        item.returnReason = reason;

        // Update orderStatus if all non-cancelled items are return requested
        const activeItems = order.items.filter(i => !i.cancelled);
        if (activeItems.every(i => i.returnRequested || i.returned)) {
            order.orderStatus = "Return Requested";
        }

        await order.save();
        res.json({ 
            success: true, 
            message: "Return request submitted successfully" 
        });
    } catch (error) {
        console.error("Error requesting return:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

exports.cancelOrderItem = async (req, res) => {
    try {
        const { orderId, itemIndex } = req.params;
        const userId = await User.findOne({email:req.session.email})

        console.log("njn ivide undee : ", req.user);
        // Find the order

        console.log("orderId :",orderId)
        const order = await Order.findOne({ _id: orderId, userId });
       
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Check if cancellation is allowed
        if (order.orderStatus !== "Pending" && order.orderStatus !== "Processing") {
            return res.status(400).json({ success: false, message: "Cannot cancel items in this order status" });
        }

        const item = order.items[itemIndex];
        if (!item || item.cancelled) {
            return res.status(400).json({ success: false, message: "Item not found or already cancelled" });
        }

        

        // Calculate the item amount to be refunded
        const cancellingItemAmount = item.price * item.quantity;

        // Find or create wallet (outside refund condition)
        let wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            wallet = new Wallet({ userId, balance: 0, transactions: [] });
        }

        // Refund logic
        let refundAmount = 0;
        if (['WALLET', 'RAZORPAY'].includes(order.paymentMethod) && order.paymentStatus === 'Paid') {
            if (order.items.length === 1) {
                
                refundAmount = order.totalPrice;
            } else if (order.items.length > 1) {
                // Check coupon conditions
                if (order.couponApplied) {
                    const coupon = await Coupon.findById(order.couponApplied);
                    if (!coupon) {
                        return res.status(400).json({ success: false, message: "Coupon not found" });
                    }

                    // Calculate coupon amount
                    let couponAmount = 0;
                    const originalTotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    if (coupon.discountType === "percentage") {
                        const discount = originalTotal * (coupon.discountValue / 100);
                        couponAmount = coupon.maximumDiscount ? Math.min(discount, coupon.maximumDiscount) : discount;
                    } else if (coupon.discountType === "fixed") {
                        couponAmount = coupon.discountValue;
                    }

                    const remainingAmount = order.totalPrice - cancellingItemAmount;
                    const ans = remainingAmount < coupon.minimumPurchase;

                    if (ans) {
                        // Deduct coupon amount from refund
                        refundAmount = cancellingItemAmount - couponAmount;
                        if (refundAmount < 0) refundAmount = 0; // Ensure refund isn’t negative
                    } else {
                        // Full item amount refund
                        refundAmount = cancellingItemAmount;
                    }
                } else {
                    // No coupon, refund full item amount
                    refundAmount = cancellingItemAmount;
                }
            }

            // Update wallet if there's a refund
            if (refundAmount > 0) {
                // Prepare transaction data
                const transactionId = uuidv4();
                const transactionDate = new Date();

                // Update embedded transactions in Wallet
                wallet.balance += refundAmount;
                wallet.transactions.push({
                    type: 'credit',
                    amount: refundAmount,
                    description: `Refund for cancelled item: ${item.productName} in Order ${orderId}`,
                    date: transactionDate
                });
                await wallet.save();

                // Save to separate WalletTransaction collection
                const walletTransaction = new WalletTransaction({
                    transactionId,
                    userId,
                    transactionType: 'CREDIT',
                    amount: refundAmount,
                    source: `Refund for cancelled item: ${item.productName} in Order ${orderId}`,
                    transactionDate,
                    orderId,
                    paymentId: null
                });
                await walletTransaction.save();
            }
        }

        // Mark item as cancelled
        item.cancelled = true;
        item.cancelledAt = new Date();
        item.cancellationReason = req.body.reason || "User cancelled";

        // Restore stock
        const variant = await Variant.findById(item.variantId);
        if (!variant) {
            return res.status(400).json({ success: false, message: "Variant not found" });
        }
        variant.stock += item.quantity;
        await variant.save();

        // Recalculate totalPrice (exclude cancelled items)
        order.totalPrice = order.items.reduce((sum, item) => {
            return sum + (item.cancelled ? 0 : item.price * item.quantity);
        }, 0);

        // If all items are cancelled, update order status
        if (order.items.every(item => item.cancelled)) {
            order.orderStatus = "Cancelled";
            order.paymentStatus = "Failed"; // Could be "Refunded" if fully refunded
        }

        await order.save();

        res.json({
            success: true,
            message: refundAmount > 0 ? `Item cancelled successfully. $${refundAmount.toFixed(2)} refunded to wallet.` : "Item cancelled successfully.",
            refundAmount,
            balance: wallet.balance // Always return the current balance
        });

    } catch (error) {
        console.error("Error cancelling item:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

exports.downloadInvoice = async (req, res) => {
    try {
        const { orderId } = req.params;
        const user = await User.findOne({ email: req.session.email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const order = await Order.findOne({ _id: orderId, userId: user._id });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Allow invoice for any order status as needed
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=invoice_${orderId}.pdf`);
        doc.pipe(res);

        // Header
        doc.fontSize(24).font('Helvetica-Bold').text("MANNIFEST E-COM", { align: "center" });
        doc.fontSize(16).text("INVOICE", { align: "center" });
        doc.moveDown(0.5);

        // Document info
        const invoiceNo = `INV-${order._id.toString().substring(18)}`;
        doc.fontSize(10).font('Helvetica')
            .text(`Invoice No: ${invoiceNo}`, { align: "center" })
            .text(`Order ID: ${order._id}`, { align: "center" })
            .text(`Date: ${new Date(order.placedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { align: "center" });
        
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // Customer Info & Company Info side by side
        const customerStartY = doc.y;
        
        // Customer Info (left side)
        doc.fontSize(12).font('Helvetica-Bold').text("BILL TO:", 50);
        doc.fontSize(10).font('Helvetica')
            .text(`${order.address.fullName}`, 50)
            .text(`${order.address.street}`, 50)
            .text(`${order.address.city}, ${order.address.state} ${order.address.zipCode}`, 50)
            .text(`${order.address.country}`, 50)
            .text(`Phone: ${order.address.phone}`, 50);
        
        // Reset Y position to draw Company info
        doc.y = customerStartY;
        
        // Company Info (right side)
        doc.fontSize(12).font('Helvetica-Bold').text("FROM:", 350);
        doc.fontSize(10).font('Helvetica')
            .text("MANNIFEST E-COM", 350)
            .text("123 Business Street", 350)
            .text("Business City, State 12345", 350)
            .text("support@mannifest.com", 350)
            .text("(123) 456-7890", 350);

        // Find the max Y between customer and company info sections
        const afterInfoY = Math.max(doc.y, customerStartY + 100);
        doc.y = afterInfoY;
        
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // Order Details
        doc.fontSize(12).font('Helvetica-Bold').text("ORDER INFORMATION");
        doc.fontSize(10).font('Helvetica')
            .text(`Payment Method: ${order.paymentMethod}`)
            .text(`Payment Status: ${order.paymentStatus}`)
            .text(`Order Status: ${order.orderStatus}`);
        
        if (order.deliveredAt) {
            doc.text(`Delivered On: ${new Date(order.deliveredAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
        }
        
        if (order.razorpayOrderId) {
            doc.text(`Payment Reference ID: ${order.razorpayOrderId}`);
        }
        
        doc.moveDown();

        // Items Table
        const tableTop = doc.y;
        
        // Table Header
        doc.fontSize(10).font('Helvetica-Bold');
        doc.rect(50, tableTop, 500, 20).fill('#f6f6f6');
        doc.fillColor('black')
            .text("ITEM", 60, tableTop + 5)
            .text("DETAILS", 220, tableTop + 5)
            .text("QTY", 350, tableTop + 5, { align: 'right' })
            .text("PRICE", 425, tableTop + 5, { align: 'right' })
            .text("AMOUNT", 525, tableTop + 5, { align: 'right' });
        
        let position = tableTop + 25;
        let totalItems = 0;
        let activeTotal = 0;
        let cancelledTotal = 0;
        let returnedTotal = 0;

        // Table Rows
        order.items.forEach((item, index) => {
            const isItemCancelled = item.cancelled === true;
            const isItemReturned = item.returned === true;
            
            let rowColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
            if (isItemCancelled) rowColor = '#ffebee'; // Light red for cancelled
            if (isItemReturned) rowColor = '#e8f5e9'; // Light green for returned
            
            const itemTotal = item.price * item.quantity;
            
            // Draw row background
            doc.rect(50, position - 5, 500, 25).fill(rowColor);
            
            // Build details string
            let details = `${item.variantColor}, Size: ${item.variantSize}`;
            let itemStatus = "";
            
            if (isItemCancelled) {
                itemStatus = "CANCELLED";
                cancelledTotal += itemTotal;
            } else if (isItemReturned) {
                itemStatus = "RETURNED";
                returnedTotal += itemTotal;
            } else {
                activeTotal += itemTotal;
            }
            
            if (itemStatus) {
                details += ` (${itemStatus})`;
            }
            
            // Set text color based on item status
            let textColor = 'black';
            if (isItemCancelled) textColor = '#d32f2f';
            if (isItemReturned) textColor = '#2e7d32';
            
            // Draw item details
            doc.fillColor(textColor).fontSize(10).font('Helvetica')
                .text(item.productName, 60, position, { width: 150 });
            
            doc.text(details, 220, position, { width: 120 });
            
            doc.text(item.quantity, 350, position, { align: 'right' })
                .text(`$${item.price.toFixed(2)}`, 425, position, { align: 'right' })
                .text(`$${itemTotal.toFixed(2)}`, 525, position, { align: 'right' });
            
            position += 25;
            totalItems += item.quantity;
        });

        // Reset text color to black after drawing items
        doc.fillColor('black');

        // Summary
        position += 10;
        doc.moveTo(50, position).lineTo(550, position).stroke();
        position += 10;

        // Display summary
        doc.fontSize(10).font('Helvetica-Bold').text("SUMMARY", 350, position);
        position += 20;
        
        doc.fontSize(10).font('Helvetica')
            .text("Subtotal:", 350, position)
            .text(`$${(activeTotal + cancelledTotal + returnedTotal).toFixed(2)}`, 525, position, { align: 'right' });
        position += 15;
        
        // Show cancelled items if any
        if (cancelledTotal > 0) {
            doc.fontSize(10).font('Helvetica')
                .text("Cancelled Items:", 350, position)
                .text(`-$${cancelledTotal.toFixed(2)}`, 525, position, { align: 'right' });
            position += 15;
        }
        
        // Show returned items if any
        if (returnedTotal > 0) {
            doc.fontSize(10).font('Helvetica')
                .text("Returned Items:", 350, position)
                .text(`-$${returnedTotal.toFixed(2)}`, 525, position, { align: 'right' });
            position += 15;
        }

        // Shipping cost
        if (order.shippingCost) {
            doc.text("Shipping Cost:", 350, position)
                .text(`$${order.shippingCost.toFixed(2)}`, 525, position, { align: 'right' });
            position += 15;
        }

        // Draw total box
        doc.rect(350, position, 200, 25).fill('#f6f6f6');
        doc.fillColor('black').fontSize(12).font('Helvetica-Bold')
            .text("TOTAL:", 360, position + 5)
            .text(`$${order.totalPrice.toFixed(2)}`, 525, position + 5, { align: 'right' });

        // Payment status indicator
        position += 40;
        const paymentColor = order.paymentStatus === 'Paid' ? '#4caf50' : order.paymentStatus === 'Pending' ? '#ff9800' : '#f44336';
        doc.rect(350, position, 200, 25).fill(paymentColor);
        doc.fillColor('white').fontSize(12).font('Helvetica-Bold')
            .text(`${order.paymentStatus.toUpperCase()}`, 450, position + 5, { align: 'center' });

        // Order status indicator
        position += 30;
        let orderStatusColor = '#2196f3'; // Default blue
        if (order.orderStatus === 'Delivered') orderStatusColor = '#4caf50';
        else if (order.orderStatus === 'Cancelled') orderStatusColor = '#f44336';
        else if (order.orderStatus === 'Returned') orderStatusColor = '#9c27b0';
        
        doc.rect(350, position, 200, 25).fill(orderStatusColor);
        doc.fillColor('white').fontSize(12).font('Helvetica-Bold')
            .text(`${order.orderStatus.toUpperCase()}`, 450, position + 5, { align: 'center' });

        // Footer
        const pageHeight = doc.page.height - 50;
        doc.fontSize(8).fillColor('black').font('Helvetica')
            .text(`Generated on: ${new Date().toLocaleString()}`, 50, pageHeight - 40, { align: 'center' })
            .text("Thank you for shopping with MANNIFEST E-COM!", 50, pageHeight - 30, { align: 'center' });
        
        doc.moveTo(50, pageHeight - 20).lineTo(550, pageHeight - 20).stroke();
        doc.fontSize(8).font('Helvetica-Bold')
            .text("MANNIFEST E-COM - All Rights Reserved", 50, pageHeight - 15, { align: 'center' });

        doc.end();
    } catch (error) {
        console.error("Error generating invoice:", error);
        res.status(500).json({ success: false, message: "Failed to generate invoice" });
    }
};

exports.orderFailure= async (req, res) => {
    const { orderId, error } = req.query;
    let errorMessage = decodeURIComponent(error) || 'Unknown error occurred';

    try {
        if (orderId) {
            const order = await Order.findById(orderId);
            if (order) {
                errorMessage = order.failureReason || errorMessage;
            } else {
                errorMessage = 'Order not found';
            }
        }
        res.render('user/order-failure', { 
            name: req.user?.name || 'Guest', 
            orderId, 
            error: errorMessage 
        });
    } catch (err) {
        console.error('Error rendering failure page:', err);
        res.render('user/order-failure', { 
            name: req.user?.name || 'Guest', 
            orderId, 
            error: 'An unexpected error occurred' 
        });
    }
};