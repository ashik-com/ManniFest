// orderCleanup.js
const cron = require('node-cron');
const Order = require('../models/orderSchema');
const Product = require('../models/productSchema');
const Variant = require('../models/variantSchema'); 

async function cleanupExpiredOrders() {
  try {
    const now = new Date();
    
    const expiredOrders = await Order.find({
      paymentStatus: 'Pending',
      paymentMethod: 'RAZORPAY',
      paymentDeadline: { $lt: now }
    });

    for (const order of expiredOrders) {
      // Restore stock for each item
      for (const item of order.items) {
        if (item.variantId) {
          await Variant.findByIdAndUpdate(item.variantId, {
            $inc: { stock: item.quantity }
          });
        } else {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity }
          });
        }
      }

      // Update order status
      order.paymentStatus = 'Failed';
      order.orderStatus = 'Cancelled';
      await order.save();
      
      console.log(`Cancelled Razorpay order ${order._id} due to payment timeout`);
    }
  } catch (error) {
    console.error('Error in order cleanup:', error);
  }
}

// Run every 5 minutes
const job = cron.schedule('*/5 * * * *', cleanupExpiredOrders);

function startCleanupJob() {
  job.start();
}

module.exports = { startCleanupJob };