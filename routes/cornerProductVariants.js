const express = require('express')
const router = express.Router()
const { body, param } = require('express-validator')
const validateRequest = require('../middleware/validateRequest')
const authMiddleware = require('../middleware/auth')
const CornerProductVariantController = require('../controllers/cornerProductVariantController')

// Validation des champs du variant
const variantValidation = [
  body('taille').notEmpty().withMessage('La taille est requise'),
  body('couleur').notEmpty().withMessage('La couleur est requise'),
  body('stock').isInt({ min: 0 }).withMessage('Le stock doit être un nombre positif'),
  body('product_name').optional().isString(),
  body('store_reference').optional().isString(),
  body('category_id').optional().isInt(),
  body('brand_id').optional().isInt(),
  body('price').optional().isFloat({ min: 0 }),
  body('active').optional().isBoolean()
]

// Validation des paramètres d'URL
const paramValidation = [
  param('productId').isInt().withMessage('L\'ID du produit doit être un nombre entier'),
  param('variantId').isInt().withMessage('L\'ID du variant doit être un nombre entier')
]

// Routes pour les variants
router.get(
  '/products/:productId/variants',
  [param('productId').isInt()],
  validateRequest,
  CornerProductVariantController.getVariants
)

router.post(
  '/products/:productId/variants',
  authMiddleware,
  [...paramValidation, ...variantValidation],
  validateRequest,
  CornerProductVariantController.createVariant
)

router.put(
  '/variants/:variantId',
  authMiddleware,
  [param('variantId').isInt(), ...variantValidation],
  validateRequest,
  CornerProductVariantController.updateVariant
)

router.delete(
  '/variants/:variantId',
  authMiddleware,
  [param('variantId').isInt()],
  validateRequest,
  CornerProductVariantController.deleteVariant
)

router.patch(
  '/variants/:variantId/stock',
  authMiddleware,
  [
    param('variantId').isInt(),
    body('quantity').isInt({ min: 0 }).withMessage('La quantité doit être un nombre positif')
  ],
  validateRequest,
  CornerProductVariantController.updateVariantStock
)

router.get(
  '/products/:productId/colors',
  [param('productId').isInt()],
  validateRequest,
  CornerProductVariantController.getAvailableColors
)

router.get(
  '/products/:productId/sizes',
  [param('productId').isInt()],
  validateRequest,
  CornerProductVariantController.getAvailableSizes
)

module.exports = router 