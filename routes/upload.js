const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'public', 'uploads'))
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const upload = multer({ storage: storage });

router.post('/', upload.array('images', 5), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).send('No files were uploaded.');
        }
        const fileUrls = req.files.map(file => `/uploads/${file.filename}`);
        res.status(200).json({ message: 'Files uploaded successfully', urls: fileUrls });
    } catch (error) {
        console.error('Error in file upload:', error);
        res.status(500).send('An error occurred during file upload');
    }
});

module.exports = router;

