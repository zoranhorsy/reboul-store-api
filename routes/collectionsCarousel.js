const express = require('express');
const router = express.Router();
const {
  getCollectionsCarousel,
  getCollectionById,
  createCollection,
  updateCollection,
  deleteCollection,
  reorderCollections
} = require('../controllers/collectionsCarouselController');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Routes publiques
router.get('/', getCollectionsCarousel);
router.get('/:id', getCollectionById);

// Routes protégées (admin seulement)
router.post('/', authenticateToken, isAdmin, createCollection);
router.put('/:id', authenticateToken, isAdmin, updateCollection);
router.delete('/:id', authenticateToken, isAdmin, deleteCollection);
router.put('/reorder/collections', authenticateToken, isAdmin, reorderCollections);

module.exports = router;
