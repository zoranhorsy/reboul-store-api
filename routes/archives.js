const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const archiveController = require('../controllers/archiveController');

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

// Routes protégées (admin)
router.get('/admin', authMiddleware, archiveController.getAllArchives);
router.post('/', authMiddleware, archiveController.createArchive);
router.put('/:id', authMiddleware, archiveController.updateArchive);
router.delete('/:id', authMiddleware, archiveController.deleteArchive);

module.exports = router; 