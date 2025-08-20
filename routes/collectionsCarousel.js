const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const {
    getAllCollections,
    getCollectionById,
    createCollection,
    updateCollection,
    deleteCollection,
    toggleCollectionStatus
} = require('../controllers/collectionsCarouselController');

// Routes publiques (pas besoin d'authentification)

// Obtenir toutes les collections actives (public)
router.get('/', getAllCollections);

// Obtenir une collection par ID (public)
router.get('/:id', getCollectionById);

// Routes admin (nécessitent une authentification)

// Créer une nouvelle collection (admin seulement)
router.post('/', authMiddleware, createCollection);

// Mettre à jour une collection (admin seulement)
router.put('/:id', authMiddleware, updateCollection);

// Supprimer une collection (admin seulement)
router.delete('/:id', authMiddleware, deleteCollection);

// Changer le statut actif/inactif d'une collection (admin seulement)
router.patch('/:id/toggle-status', authMiddleware, toggleCollectionStatus);

module.exports = router;
