const express = require('express');
const router = express.Router();
const { AppError } = require('../middleware/errorHandler');
const authMiddleware = require('../middleware/auth');
const CategoryController = require('../controllers/categoryController');

// GET toutes les catégories
router.get('/', CategoryController.getAllCategories);

// GET une catégorie spécifique
router.get('/:id', CategoryController.getCategoryById);

// POST une nouvelle catégorie (protégé par authMiddleware)
router.post('/', authMiddleware, CategoryController.createCategory);

// PUT mettre à jour une catégorie (protégé par authMiddleware)
router.put('/:id', authMiddleware, CategoryController.updateCategory);

// DELETE supprimer une catégorie (protégé par authMiddleware)
router.delete('/:id', authMiddleware, CategoryController.deleteCategory);

module.exports = router;