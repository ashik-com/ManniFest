const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Set correct upload directory for profile pictures
const uploadDir = path.join(__dirname, "../public/uploads/profile_pictures");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    } else {
        cb(new Error("Only image files are allowed"), false);
    }
};

// ✅ Use .single() instead of .any()
const profile = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single("profilePicture"); // ⬅️ Must match the frontend FormData field

module.exports = profile;
