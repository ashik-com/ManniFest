const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const Variant = require("../models/variantSchema")
const Order = require("../models/orderSchema")
const bcrypt = require("bcrypt");


exports.getDashboard = async (req, res) => {
    try {
      const { salesFilter = 'yearly', orderFilter = 'yearly' } = req.query;
  
      // Calculate date range based on filter
      const getDateRange = (filter) => {
        const now = new Date();
        switch (filter) {
          case 'daily':
            return { start: new Date(now.setHours(0,0,0,0)), end: new Date() };
          case 'weekly':
            return { start: new Date(now.setDate(now.getDate() - 7)), end: new Date() };
          case 'monthly':
            return { start: new Date(now.setMonth(now.getMonth() - 1)), end: new Date() };
          case 'yearly':
          default:
            return { start: new Date(now.setFullYear(now.getFullYear() - 1)), end: new Date() };
        }
      };
  
      // Dashboard summary data
      const dashboardData = {
        totalOrders: await Order.countDocuments(), // All orders regardless of status
        deliveredOrders: await Order.countDocuments({ orderStatus: 'Delivered' }),
        totalUsers: await User.countDocuments({ isAdmin: false }),
        totalProducts: await Product.countDocuments({ isListed: true }),
        totalRevenue: await Order.aggregate([
          { $match: { orderStatus: 'Delivered' } },
          { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ]).then(result => result[0]?.total || 0),
      };
  
      // Sales chart data (based on delivered orders)
      const salesRange = getDateRange(salesFilter);
      const salesData = await Order.aggregate([
        { $match: { 
          orderStatus: 'Delivered',
          placedAt: { $gte: salesRange.start, $lte: salesRange.end }
        }},
        { $group: {
          _id: {
            $dateToString: { 
              format: salesFilter === 'daily' ? '%H' : 
                     salesFilter === 'weekly' ? '%Y-%m-%d' : 
                     salesFilter === 'monthly' ? '%Y-%m' : '%Y',
              date: '$placedAt' 
            }
          },
          total: { $sum: '$totalPrice' }
        }},
        { $sort: { '_id': 1 } }
      ]);
  
      const salesChartData = {
        labels: salesData.map(d => d._id),
        values: salesData.map(d => d.total)
      };
  
      // Order chart data (based on all orders)
      const orderRange = getDateRange(orderFilter);
      const orderData = await Order.aggregate([
        { $match: { 
          placedAt: { $gte: orderRange.start, $lte: orderRange.end }
        }},
        { $group: {
          _id: {
            $dateToString: { 
              format: orderFilter === 'daily' ? '%H' : 
                     orderFilter === 'weekly' ? '%Y-%m-%d' : 
                     orderFilter === 'monthly' ? '%Y-%m' : '%Y',
              date: '$placedAt' 
            }
          },
          count: { $sum: 1 }
        }},
        { $sort: { '_id': 1 } }
      ]);
  
      const orderChartData = {
        labels: orderData.map(d => d._id),
        values: orderData.map(d => d.count)
      };
  
      // Top performers
      const topProducts = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $unwind: '$items' },
        { $match: { 'items.cancelled': false, 'items.returned': false } },
        { $group: {
          _id: '$items.productId',
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          name: { $first: '$items.productName' }
        }},
        { $sort: { revenue: -1 } },
        { $limit: 5 }
      ]);
  
      const topCategories = await Order.aggregate([
        { $match: { orderStatus: 'Delivered' } },
        { $unwind: '$items' },
        { $match: { 'items.cancelled': false, 'items.returned': false } },
        { $group: {
          _id: '$items.category',
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }},
        { $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category'
        }},
        { $unwind: '$category' },
        { $project: {
          _id: 1,
          revenue: 1,
          name: '$category.name'
        }},
        { $sort: { revenue: -1 } },
        { $limit: 5 }
      ]);
  
      const topBrands = []; // No brands as per your requirement
  
      // Render the dashboard
      res.render('admin/dashboard', {
        dashboardData,
        salesChartData,
        orderChartData,
        topProducts,
        topCategories,
        topBrands
      });
  
    } catch (error) {
      console.error(error);
      res.status(500).render('error', { message: 'Server Error' });
    }
  };

// Sales Helper Functions (unchanged from previous)
async function getYearlySales(currentDate) {
   const start = new Date(currentDate.getFullYear(), 0, 1);
   const end = new Date(currentDate.getFullYear(), 11, 31);
   const sales = await Order.aggregate([
       { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: 'Paid' } },
       { $group: { _id: { $month: '$placedAt' }, total: { $sum: '$totalPrice' } } },
       { $sort: { '_id': 1 } }
   ]);
   const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
   const values = Array(12).fill(0);
   sales.forEach(s => values[s._id - 1] = s.total);
   return { labels, values };
}

async function getMonthlySales(currentDate) {
   const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
   const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
   const sales = await Order.aggregate([
       { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: 'Paid' } },
       { $group: { _id: { $dayOfMonth: '$placedAt' }, total: { $sum: '$totalPrice' } } },
       { $sort: { '_id': 1 } }
   ]);
   const daysInMonth = end.getDate();
   const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
   const values = Array(daysInMonth).fill(0);
   sales.forEach(s => values[s._id - 1] = s.total);
   return { labels, values };
}

async function getWeeklySales(currentDate) {
   const start = new Date(currentDate);
   start.setDate(start.getDate() - start.getDay());
   const end = new Date(start);
   end.setDate(end.getDate() + 6);
   const sales = await Order.aggregate([
       { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: 'Paid' } },
       { $group: { _id: { $dayOfWeek: '$placedAt' }, total: { $sum: '$totalPrice' } } },
       { $sort: { '_id': 1 } }
   ]);
   const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
   const values = Array(7).fill(0);
   sales.forEach(s => values[s._id - 1] = s.total);
   return { labels, values };
}

async function getDailySales(currentDate) {
   const start = new Date(currentDate.setHours(0, 0, 0, 0));
   const end = new Date(currentDate.setHours(23, 59, 59, 999));
   const sales = await Order.aggregate([
       { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: 'Paid' } },
       { $group: { _id: { $hour: '$placedAt' }, total: { $sum: '$totalPrice' } } },
       { $sort: { '_id': 1 } }
   ]);
   const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
   const values = Array(24).fill(0);
   sales.forEach(s => values[s._id] = s.total);
   return { labels, values };
}

// Order Count Helper Functions
async function getYearlyOrders(currentDate) {
   const start = new Date(currentDate.getFullYear(), 0, 1);
   const end = new Date(currentDate.getFullYear(), 11, 31);
   const orders = await Order.aggregate([
       { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: 'Paid' } },
       { $group: { _id: { $month: '$placedAt' }, count: { $sum: 1 } } },
       { $sort: { '_id': 1 } }
   ]);
   const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
   const values = Array(12).fill(0);
   orders.forEach(o => values[o._id - 1] = o.count);
   return { labels, values };
}

async function getMonthlyOrders(currentDate) {
   const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
   const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
   const orders = await Order.aggregate([
       { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: 'Paid' } },
       { $group: { _id: { $dayOfMonth: '$placedAt' }, count: { $sum: 1 } } },
       { $sort: { '_id': 1 } }
   ]);
   const daysInMonth = end.getDate();
   const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
   const values = Array(daysInMonth).fill(0);
   orders.forEach(o => values[o._id - 1] = o.count);
   return { labels, values };
}

async function getWeeklyOrders(currentDate) {
   const start = new Date(currentDate);
   start.setDate(start.getDate() - start.getDay());
   const end = new Date(start);
   end.setDate(end.getDate() + 6);
   const orders = await Order.aggregate([
       { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: 'Paid' } },
       { $group: { _id: { $dayOfWeek: '$placedAt' }, count: { $sum: 1 } } },
       { $sort: { '_id': 1 } }
   ]);
   const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
   const values = Array(7).fill(0);
   orders.forEach(o => values[o._id - 1] = o.count);
   return { labels, values };
}

async function getDailyOrders(currentDate) {
   const start = new Date(currentDate.setHours(0, 0, 0, 0));
   const end = new Date(currentDate.setHours(23, 59, 59, 999));
   const orders = await Order.aggregate([
       { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: 'Paid' } },
       { $group: { _id: { $hour: '$placedAt' }, count: { $sum: 1 } } },
       { $sort: { '_id': 1 } }
   ]);
   const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
   const values = Array(24).fill(0);
   orders.forEach(o => values[o._id] = o.count);
   return { labels, values };
}