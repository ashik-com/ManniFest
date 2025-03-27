const Order = require("../models/orderSchema");
const Coupon = require("../models/couponSchema");
const PDFDocument = require("pdfkit");
const moment = require("moment");
const ExcelJS = require("exceljs");



exports.getSalesReport = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    // Determine date range
    let start, end;
    switch (type) {
      case "daily":
        start = moment().startOf("day").toDate();
        end = moment().endOf("day").toDate();
        break;
      case "weekly":
        start = moment().subtract(6, "days").startOf("day").toDate();
        end = moment().endOf("day").toDate();
        break;
      case "yearly":
        start = moment().startOf("year").toDate();
        end = moment().endOf("year").toDate();
        break;
      case "custom":
        start = startDate ? new Date(startDate) : moment().subtract(30, "days").toDate();
        end = endDate ? new Date(endDate) : new Date();
        break;
      default: // Monthly
        start = moment().startOf("month").toDate();
        end = moment().endOf("month").toDate();
    }

    // Summary: sales count, order amount, discount
    const summary = await Order.aggregate([
      { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: "Paid" } },
      {
        $lookup: {
          from: "coupons",
          localField: "couponApplied",
          foreignField: "_id",
          as: "coupon",
        },
      },
      { $unwind: { path: "$coupon", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          totalOrderAmount: { $sum: "$totalPrice" },
          totalDiscount: {
            $sum: {
              $cond: {
                if: { $eq: ["$coupon", null] },
                then: 0,
                else: {
                  $cond: {
                    if: { $eq: ["$coupon.discountType", "percentage"] },
                    then: { $multiply: ["$totalPrice", "$coupon.discountValue", 0.01] },
                    else: "$coupon.discountValue",
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          orderCount: 1,
          totalOrderAmount: 1,
          totalDiscount: 1,
          netSales: { $subtract: ["$totalOrderAmount", "$totalDiscount"] },
        },
      },
    ]);

    // Sales trend with product names
    const trend = await Order.aggregate([
      { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: "Paid" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$placedAt" } },
          orders: {
            $push: {
              orderId: "$_id",
              productName: "$items.productName",
              paymentMethod: "$paymentMethod",
              orderStatus: "$orderStatus",
              totalPrice: "$totalPrice",
              discount: { $ifNull: ["$couponDiscountAmount", 0] },
            },
          },
          dailySales: { $sum: "$totalPrice" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top products
    const topProducts = await Order.aggregate([
      { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: "Paid" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
    ]);

    // Top categories
    const topCategories = await Order.aggregate([
      { $match: { placedAt: { $gte: start, $lte: end }, paymentStatus: "Paid" } },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "categories",
          localField: "items.category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $group: {
          _id: "$items.category",
          categoryName: { $first: "$categoryInfo.name" },
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 5 },
    ]);

    const report = {
      summary: summary[0] || { orderCount: 0, totalOrderAmount: 0, totalDiscount: 0, netSales: 0 },
      trend,
      topProducts,
      topCategories,
      filters: { type: type || "monthly", startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0] },
    };

    res.render("admin/sales-reports", report);
  } catch (error) {
    console.error("Sales report error:", error);
    res.status(500).send("Failed to generate sales report");
  }
};

exports.downloadSalesReport = async (req, res) => {
  try {
    const { format = "pdf", type, startDate, endDate } = req.query;
    console.log("Download request received:", { format, type, startDate, endDate });

    req.query = { type, startDate, endDate };
    const report = await new Promise((resolve) => {
      exports.getSalesReport(req, {
        render: (view, data) => resolve(data),
        status: () => ({ send: () => {} }),
      });
    });
    console.log("Report data prepared:", report);

    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=sales-report-${Date.now()}.pdf`);
      doc.pipe(res);

      doc.fontSize(24).font("Helvetica-Bold").text("MANNIFEST E-COM", { align: "center" });
      doc.fontSize(16).font("Helvetica").text("Sales Report", { align: "center" });
      doc.fontSize(10).text(`Period: ${report.filters.startDate} to ${report.filters.endDate}`, { align: "center" });
      doc.moveDown(2);

      doc.fontSize(14).font("Helvetica-Bold").text("Summary", 50, doc.y, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica")
        .text(`Overall Sales Count: ${report.summary.orderCount}`, 70)
        .text(`Overall Order Amount: ₹${report.summary.totalOrderAmount.toFixed(2)}`, 70)
        .text(`Overall Discount: ₹${report.summary.totalDiscount.toFixed(2)}`, 70)
        .text(`Net Sales: ₹${report.summary.netSales.toFixed(2)}`, 70);
      doc.moveDown(2);

      doc.fontSize(14).font("Helvetica-Bold").text("Sales Trend", 50, doc.y, { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const columnWidth = 90;
      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Period", 50, tableTop, { width: columnWidth });
      doc.text("Order ID", 140, tableTop, { width: columnWidth });
      doc.text("Product", 230, tableTop, { width: columnWidth });
      doc.text("Payment", 320, tableTop, { width: columnWidth });
      doc.text("Status", 410, tableTop, { width: columnWidth });
      doc.text("Discount",410,tableTop,{width:columnWidth}),
      doc.text("Total (₹)", 500, tableTop, { width: columnWidth, align: "right" });

      doc.moveTo(50, tableTop + 15).lineTo(590, tableTop + 15).stroke();
      let position = tableTop + 25;

      doc.fontSize(10).font("Helvetica");
      report.trend.forEach((t) => {
        doc.text(t._id, 50, position, { width: columnWidth });
        t.orders.forEach((order, index) => {
          if (index > 0) position += 20;
          doc.text(order.orderId.toString(), 140, position, { width: columnWidth });
          doc.text(order.productName || "Unknown", 230, position, { width: columnWidth });
          doc.text(order.paymentMethod || "N/A", 320, position, { width: columnWidth });
          doc.text(order.orderStatus || "N/A", 410, position, { width: columnWidth });
          doc.text(order.couponDiscountAmount ||"N/A",position,410,{width:columnWidth}),
          doc.text(`₹${(order.totalPrice || 0).toFixed(2)}`, 500, position, { width: columnWidth, align: "right" });
        });
        position += 20;
      });

      doc.moveTo(50, position).lineTo(590, position).stroke();
      doc.moveDown(2);

      doc.fontSize(14).font("Helvetica-Bold").text("Top Products", 50, doc.y, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica");
      report.topProducts.forEach((product, index) => {
        doc.text(`${index + 1}. ${product.productName} - ${product.totalSold} units, ₹${product.totalRevenue.toFixed(2)}`, 70);
      });

      doc.moveDown(2);
      doc.fontSize(14).font("Helvetica-Bold").text("Top Categories", 50, doc.y, { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12).font("Helvetica");
      report.topCategories.forEach((category, index) => {
        doc.text(`${index + 1}. ${category.categoryName} - ${category.totalSold} units, ₹${category.totalRevenue.toFixed(2)}`, 70);
      });

      doc.moveDown(2);
      doc.fontSize(8).font("Helvetica-Oblique")
        .text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" })
        .text("MANNIFEST E-COM - All Rights Reserved", { align: "center" });

      doc.end();
      console.log("PDF generation completed");
    } else if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Admin";
      workbook.created = new Date();

      const salesSheet = workbook.addWorksheet("Sales Report");

      salesSheet.addRow(["Sales Report"]);
      salesSheet.addRow(["Period", `${report.filters.startDate} to ${report.filters.endDate}`]);
      salesSheet.addRow([]);
      salesSheet.addRow(["Summary"]);
      salesSheet.addRow(["Overall Sales Count", report.summary.orderCount]);
      salesSheet.addRow(["Overall Order Amount", `₹${report.summary.totalOrderAmount.toFixed(2)}`]);
      salesSheet.addRow(["Overall Discount", `₹${report.summary.totalDiscount.toFixed(2)}`]);
      salesSheet.addRow(["Net Sales", `₹${report.summary.netSales.toFixed(2)}`]);
      salesSheet.addRow([]);

      salesSheet.addRow(["Sales Trend"]);
      salesSheet.addRow(["Period", "Order ID", "Product Name", "Payment Method", "Status", "Total Sales (₹)", "Discount (₹)"]);
      report.trend.forEach((t) => {
        t.orders.forEach((order) => {
          salesSheet.addRow([
            t._id,
            order.orderId.toString(),
            order.productName || "Unknown",
            order.paymentMethod || "N/A",
            order.orderStatus || "N/A",
            `₹${(order.totalPrice || 0).toFixed(2)}`,
            `₹${(order.discount || 0).toFixed(2)}`,
          ]);
        });
      });
      salesSheet.addRow([]);

      salesSheet.addRow(["Top Products"]);
      salesSheet.addRow(["Product Name", "Units Sold", "Revenue (₹)"]);
      report.topProducts.forEach((product) => {
        salesSheet.addRow([product.productName, product.totalSold, `₹${product.totalRevenue.toFixed(2)}`]);
      });
      salesSheet.addRow([]);

      salesSheet.addRow(["Top Categories"]);
      salesSheet.addRow(["Category Name", "Units Sold", "Revenue (₹)"]);
      report.topCategories.forEach((category) => {
        salesSheet.addRow([category.categoryName, category.totalSold, `₹${category.totalRevenue.toFixed(2)}`]);
      });

      salesSheet.eachRow((row, rowNumber) => {
        if ([1, 4, 10, 13, 16].includes(rowNumber)) {
          row.font = { bold: true, size: 14 };
        }
        row.eachCell((cell) => {
          cell.alignment = { vertical: "middle", horizontal: "left" };
          cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        });
      });

      salesSheet.columns = [
        { width: 15 },
        { width: 25 },
        { width: 20 },
        { width: 15 },
        { width: 15 },
        { width: 20 },
        { width: 15 },
      ];

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=sales-report-${Date.now()}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
      console.log("Excel generation completed");
    } else {
      res.status(400).json({ success: false, message: "Unsupported format. Use 'pdf' or 'excel'." });
    }
  } catch (error) {
    console.error("Download sales report error:", error);
    res.status(500).send("Failed to download sales report");
  }
};