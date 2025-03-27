const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema")
const Variant = require("../models/variantSchema")
const Order = require("../models/orderSchema")
const bcrypt = require("bcrypt");


exports.getDashboard = async (req, res) => {
   try {
       const salesFilter = req.query.salesFilter || 'monthly';
       const orderFilter = req.query.orderFilter || 'monthly';
       const currentDate = new Date();

       // Sales Chart Data (Total Sales)
       let salesChartData = {};
       switch (salesFilter) {
           case 'yearly': salesChartData = await getYearlySales(currentDate); break;
           case 'monthly': salesChartData = await getMonthlySales(currentDate); break;
           case 'weekly': salesChartData = await getWeeklySales(currentDate); break;
           case 'daily': salesChartData = await getDailySales(currentDate); break;
       }

       // Order Count Chart Data
       let orderChartData = {};
       switch (orderFilter) {
           case 'yearly': orderChartData = await getYearlyOrders(currentDate); break;
           case 'monthly': orderChartData = await getMonthlyOrders(currentDate); break;
           case 'weekly': orderChartData = await getWeeklyOrders(currentDate); break;
           case 'daily': orderChartData = await getDailyOrders(currentDate); break;
       }

       // Top 10 Best Selling Products
       const topProducts = await Order.aggregate([
           { $unwind: '$items' },
           { $match: { paymentStatus: 'Paid', orderStatus: { $nin: ['Cancelled', 'Returned'] } } },
           { $group: { _id: '$items.productId', unitsSold: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
           { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
           { $unwind: '$product' },
           { $project: { name: '$product.name', unitsSold: 1, revenue: 1 } },
           { $sort: { revenue: -1 } },
           { $limit: 10 }
       ]);

       // Top 10 Best Selling Categories
       const topCategories = await Order.aggregate([
           { $unwind: '$items' },
           { $match: { paymentStatus: 'Paid', orderStatus: { $nin: ['Cancelled', 'Returned'] } } },
           { $group: { _id: '$items.category', unitsSold: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
           { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
           { $unwind: '$category' },
           { $project: { name: '$category.name', unitsSold: 1, revenue: 1 } },
           { $sort: { revenue: -1 } },
           { $limit: 10 }
       ]);

       // Top 10 Best Selling Brands
       const topBrands = await Order.aggregate([
           { $unwind: '$items' },
           { $match: { paymentStatus: 'Paid', orderStatus: { $nin: ['Cancelled', 'Returned'] } } },
           { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'product' } },
           { $unwind: '$product' },
           { $group: { _id: '$product.brand', unitsSold: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
           { $project: { name: '$_id', unitsSold: 1, revenue: 1 } },
           { $sort: { revenue: -1 } },
           { $limit: 10 }
       ]);

       res.render('admin/dashboard', {
           salesChartData,
           orderChartData,
           topProducts,
           topCategories,
           topBrands,
           salesFilter,
           orderFilter
       });
   } catch (error) {
       console.error("Error fetching dashboard data:", error);
       res.status(500).render('admin/dashboard', {
           salesChartData: { labels: [], values: [] },
           orderChartData: { labels: [], values: [] },
           topProducts: [],
           topCategories: [],
           topBrands: [],
           salesFilter: 'monthly',
           orderFilter: 'monthly',
           error: "Error loading dashboard data"
       });
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