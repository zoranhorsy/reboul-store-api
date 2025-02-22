const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const archiveController = require('../controllers/archiveController');

// Configuration de multer pour le stockage en mémoire
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // Limite de 5MB
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Le fichier doit être une image'), false);
        }
    },
});

// Routes publiques
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM archives WHERE active = true ORDER BY date DESC'
        );
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des archives:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la récupération des archives'
        });
    }
});

// Routes admin (protégées)
router.use(authMiddleware);

// Routes admin
router.get('/all', archiveController.getAllArchives);
router.post('/', upload.single('image'), archiveController.createArchive);
router.put('/:id', upload.single('image'), archiveController.updateArchive);
router.delete('/:id', archiveController.deleteArchive);

module.exports = router; 