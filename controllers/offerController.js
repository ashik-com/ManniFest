// controllers/offerController.js
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema");
const Offer = require("../models/offersSchema");

// Get all offers (both product and category)
exports.getOffer = async (req, res) => {
    try {
        const offers = await Offer.find({})
            .populate('categoryId', 'name')
            .populate('productId', 'name')
            .lean();
        
        const today = new Date();
        const enrichedOffers = offers.map(offer => ({
            ...offer,
            categoryName: offer.categoryId?.name || offer.categoryName || null,
            productName: offer.productId?.name || null,
            isActive: offer.startDate <= today && offer.endDate >= today,
        }));

        res.render("admin/offers", { categoryOffers: enrichedOffers }); // Consider renaming to 'offers'
    } catch (error) {
        console.error('Error fetching offers:', error);
        res.status(500).render("admin/offers", { 
            categoryOffers: [], 
            error: "Failed to load offers. Please try again later." 
        });
    }
};

// Get add offer page (for categories)
exports.getAddOffer = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id).lean();
        if (!category) {
            return res.status(404).send('Category not found');
        }
        res.render('admin/addOffers', { category });
    } catch (error) {
        console.error('Error rendering add category offer page:', error);
        res.status(500).send('Server error');
    }
};

// Get add product offer page
exports.getAddProductOffer = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).lean();
        if (!product) {
            return res.status(404).send('Product not found');
        }
        res.render('admin/product-offer', { product });
    } catch (error) {
        console.error('Error rendering add product offer page:', error);
        res.status(500).send('Server error');
    }
};


exports.addOffer = async (req, res) => {
    const { offerType, productId, categoryId, discountType, discountValue, startDate, endDate, categoryName } = req.body;

    try {
        // Validation
        if (!offerType || !discountType || !discountValue || !startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Required fields are missing' });
        }
        if (!['product', 'category'].includes(offerType)) {
            return res.status(400).json({ success: false, message: 'Invalid offer type' });
        }
        if (offerType === 'product' && !productId) {
            return res.status(400).json({ success: false, message: 'Product ID is required for Product Offer' });
        }
        if (offerType === 'category' && !categoryId) {
            return res.status(400).json({ success: false, message: 'Category ID is required for Category Offer' });
        }
        if (!['percentage', 'fixed'].includes(discountType)) {
            return res.status(400).json({ success: false, message: 'Invalid discount type' });
        }

        const discountNum = parseFloat(discountValue);
        if (isNaN(discountNum) || discountNum <= 0) {
            return res.status(400).json({ success: false, message: 'Discount value must be a positive number' });
        }
        if (discountType === 'percentage' && discountNum > 75) {
            return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 75%' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format' });
        }
        if (start >= end) {
            return res.status(400).json({ success: false, message: 'End date must be after start date' });
        }

        // Check existence
        if (offerType === 'product') {
            const productExists = await Product.findById(productId);
            if (!productExists) {
                return res.status(400).json({ success: false, message: 'Product does not exist' });
            }
        } else if (offerType === 'category') {
            const categoryExists = await Category.findById(categoryId);
            if (!categoryExists) {
                return res.status(400).json({ success: false, message: 'Category does not exist' });
            }
        }

        // Check for existing offer
       

        // Create new offer
        const newOffer = new Offer({
            type: offerType,
            discountType,
            discountValue: discountNum,
            productId: offerType === 'product' ? productId : null,
            categoryId: offerType === 'category' ? categoryId : null,
            startDate: start,
            endDate: end,
            categoryName: offerType === 'category' ? categoryName : null, // Only for category offers
            isActive: true, // Default to active
        });

        await newOffer.save();
        res.json({ success: true, message: 'Offer added successfully' });
    } catch (error) {
        console.error('Error adding offer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Toggle offer status
exports.toggleOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const offer = await Offer.findById(offerId);
        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }

        offer.isActive = !offer.isActive;
        await offer.save();
        res.redirect('/admin/offers');
    } catch (error) {
        console.error('Error toggling offer:', error);
        res.status(500).redirect('/admin/offers?error=Failed to toggle offer');
    }
};

// Delete offer
exports.deleteOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const offer = await Offer.findByIdAndDelete(offerId);
        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }

        res.redirect('/admin/offers');
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).redirect('/admin/offers?error=Failed to delete offer');
    }
};

exports.editCategoryOffer = async (req, res) => {
    try {
        const offer = await Offer.findById(req.params.id)
            .populate('productId', 'name')
            .populate('categoryId', 'name')
            .lean();
        if (!offer) {
            return res.status(404).send('Offer not found');
        }
        res.render('admin/edit-offer', { offer });
    } catch (error) {
        console.error('Error fetching offer for edit:', error);
        res.status(500).send('Server error');
    }
};

exports.updateCategoryOffer = async (req, res) => {
    const { discountType, discountValue, startDate, endDate } = req.body;
    const offerId = req.params.id;

    try {
        const discountNum = parseFloat(discountValue);
        if (!['percentage', 'fixed'].includes(discountType)) {
            return res.status(400).json({ success: false, message: 'Invalid discount type' });
        }
        if (isNaN(discountNum) || discountNum <= 0) {
            return res.status(400).json({ success: false, message: 'Discount value must be a positive number' });
        }
        if (discountType === 'percentage' && discountNum > 100) {
            return res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format' });
        }
        if (start >= end) {
            return res.status(400).json({ success: false, message: 'End date must be after start date' });
        }

        const offer = await Offer.findByIdAndUpdate(
            offerId,
            { discountType, discountValue: discountNum, startDate: start, endDate: end },
            { new: true }
        );
        if (!offer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }

        res.json({ success: true, message: 'Offer updated successfully' });
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getEditProductOffer = async (req, res) => {
    try {
        const productId = req.params.productId;
        
        // Find the product
        const product = await Product.findById(productId)
            .populate('category', 'name')
            .lean();
        
        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Find the existing offer for this product
        const offer = await Offer.findOne({
            productId: productId,
            isActive: true,
            endDate: { $gte: new Date() }
        }).lean();

        if (!offer) {
            return res.redirect('/admin/products'); // Redirect if no active offer exists
        }

        res.render('admin/edit-product-offer', {
            product,
            offer,
            error: null
        });
    } catch (error) {
        console.error('Error fetching offer:', error);
        res.status(500).send('Server error');
    }
};

exports.updateProductOffer = async (req, res) => {
    try {
        const productId = req.params.productId;
        const {
            discountType,
            discountValue,
            startDate,
            endDate
        } = req.body;

       
        if (!discountType || !discountValue || !startDate || !endDate) {
            const product = await Product.findById(productId).lean();
            return res.render('admin/edit-product-offer', {
                product,
                offer: req.body,
                error: 'All fields are required',
                success: false
            });
        }

        if (discountValue <=0 ) {
           return res.status(400).json({ message: 'discount must be greater than 0' });
        }

        if (new Date(startDate) >= new Date(endDate)) {
            const product = await Product.findById(productId).lean();
            return res.render('admin/edit-product-offer', {
                product,
                offer: req.body,
                error: 'End date must be after start date',
                success: false
            });
        }

        // Update the offer
        const updatedOffer = await Offer.findOneAndUpdate(
            { productId: productId, isActive: true },
            {
                discountType,
                discountValue,
                startDate,
                endDate,
                updatedAt: Date.now()
            },
            { new: true }
        );

        if (!updatedOffer) {
            return res.status(404).send('Offer not found');
        }

        // Render the page with success flag instead of redirecting
        const product = await Product.findById(productId)
            .populate('category', 'name')
            .lean();
        
            res.status(200).json({ message: 'Offer updated successfully' });
    } catch (error) {
        console.error('Error updating offer:', error);
        const product = await Product.findById(productId).lean();
        res.render('admin/edit-product-offer', {
            product,
            offer: req.body,
            error: 'Error updating offer',
            success: false
        });
    }
};


exports.deleteProductOffer =    async (req, res) => {
    try {
        const productId = req.params.productId;

        const deletedOffer = await Offer.findOneAndDelete({
            productId: productId,
            isActive: true
        });

        if (!deletedOffer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        // Return JSON response instead of redirect
        res.status(200).json({ message: 'Offer deleted successfully' });
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({ error: 'Server error' });
    }
};