const express = require("express")
const router = express.Router()
const { body, param, query, validationResult } = require("express-validator")
const { AppError } = require("../middleware/errorHandler")
const authMiddleware = require("../middleware/auth")
const uploadFields = require("../middleware/upload")
const { CornerProductController } = require("../controllers/cornerProductController")
const pool = require("../db")

// Middleware de validation
const validateRequest = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Erreur de validation", 400, errors.array()))
  }
  next()
}

// Validation des prix
const priceValidation = [
  body("price").isFloat({ min: 0 }).withMessage("Le prix doit être un nombre positif"),
  body("old_price").optional().isFloat({ min: 0 }).withMessage("L'ancien prix doit être un nombre positif"),
]

// Validation des variants
const variantValidation = [
  body("variants").optional().isArray().withMessage("Les variants doivent être un tableau"),
  body("variants.*.color").optional().isString().notEmpty().withMessage("La couleur est requise"),
  body("variants.*.size").optional().isString().notEmpty().withMessage("La taille est requise"),
  body("variants.*.stock").optional().isInt({ min: 0 }).withMessage("Le stock doit être un nombre positif"),
]

// GET tous les produits The Corner avec filtrage
router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("La page doit être un nombre entier positif"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("La limite doit être entre 1 et 100"),
    query("category_id").optional().isInt().withMessage("category_id doit être un nombre entier"),
    query("brand").optional().isString(),
    query("brand_id").optional().isInt().withMessage("brand_id doit être un nombre entier"),
    query("minPrice").optional().isFloat({ min: 0 }).withMessage("Le prix minimum doit être un nombre positif"),
    query("maxPrice").optional().isFloat({ min: 0 }).withMessage("Le prix maximum doit être un nombre positif"),
    query("featured").optional().isBoolean(),
    query("search").optional().isString(),
    query("sort").optional().isIn(["name", "price"]).withMessage("Le tri doit être soit par nom, soit par prix"),
    query("order").optional().isIn(["asc", "desc"]).withMessage("L'ordre doit être asc ou desc"),
    query("inStock").optional().isBoolean(),
    query("fields").optional().isString().withMessage("Le format de fields doit être une chaîne de caractères (ex: 'id,name,price')"),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      console.log('--- REQUÊTE GET /api/corner-products REÇUE ---')
      console.log('Query params:', req.query)
      
      const result = await CornerProductController.getAllCornerProducts(req)
      res.json(result)
    } catch (error) {
      console.error('Erreur dans GET /corner-products:', error)
      next(error)
    }
  }
)

// GET un produit The Corner par ID
router.get(
  "/:id",
  param("id").isInt().withMessage("L'ID du produit doit être un nombre entier"),
  validateRequest,
  async (req, res, next) => {
    try {
      const product = await CornerProductController.getCornerProductById(req.params.id)
      res.json(product)
    } catch (err) {
      next(err)
    }
  }
)

// POST pour créer un nouveau produit The Corner
router.post(
  "/",
  authMiddleware,
  uploadFields,
  [
    body("name").notEmpty().withMessage("Le nom du produit est requis"),
    ...priceValidation,
    ...variantValidation,
    body("description").optional().isString(),
    body("category_id").optional().isInt(),
    body("brand").optional().isString(),
    body("brand_id").optional().isInt(),
    body("featured").optional().isBoolean(),
    body("new").optional().isBoolean(),
    body("sku").optional().isString(),
    body("store_reference").optional().isString(),
    body("material").optional().isString(),
    body("weight").optional().isInt({ min: 0 }),
    body("dimensions").optional().isString(),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const product = await CornerProductController.createCornerProduct(req.body, req.files)
      res.status(201).json(product)
    } catch (err) {
      next(err)
    }
  }
)

// PUT pour mettre à jour un produit The Corner
router.put(
  "/:id",
  authMiddleware,
  uploadFields,
  [
    param("id").isInt().withMessage("L'ID du produit doit être un nombre entier"),
    body("name").optional().notEmpty().withMessage("Le nom du produit ne peut pas être vide"),
    ...priceValidation,
    ...variantValidation,
    body("description").optional().isString(),
    body("category_id").optional().isInt(),
    body("brand").optional().isString(),
    body("brand_id").optional().isInt(),
    body("featured").optional().isBoolean(),
    body("new").optional().isBoolean(),
    body("sku").optional().isString(),
    body("store_reference").optional().isString(),
    body("material").optional().isString(),
    body("weight").optional().isInt({ min: 0 }),
    body("dimensions").optional().isString(),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const product = await CornerProductController.updateCornerProduct(req.params.id, req.body, req.files)
      res.json(product)
    } catch (err) {
      next(err)
    }
  }
)

// PATCH pour mettre à jour le stock d'un variant
router.patch(
  "/:id/stock",
  authMiddleware,
  [
    param("id").isInt().withMessage("L'ID du produit doit être un nombre entier"),
    body("color").notEmpty().withMessage("La couleur est requise"),
    body("size").notEmpty().withMessage("La taille est requise"),
    body("quantity").isInt({ min: 0 }).withMessage("La quantité doit être un nombre positif"),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const product = await CornerProductController.updateVariantStock(req.params.id, req.body)
      res.json(product)
    } catch (err) {
      next(err)
    }
  }
)

// DELETE pour supprimer un produit The Corner
router.delete(
  "/:id",
  authMiddleware,
  param("id").isInt().withMessage("L'ID du produit doit être un nombre entier"),
  validateRequest,
  async (req, res, next) => {
    try {
      const deletedProduct = await CornerProductController.deleteCornerProduct(req.params.id)
      res.json({ 
        message: "Produit The Corner supprimé avec succès", 
        product: deletedProduct,
        type: deletedProduct.active === false ? "soft_delete" : "hard_delete"
      })
    } catch (err) {
      next(err)
    }
  }
)

// À la fin du fichier, après toutes les routes
router.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message
  })
})

module.exports = router 