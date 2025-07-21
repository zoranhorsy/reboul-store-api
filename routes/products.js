const express = require("express")
const router = express.Router()
const { body, param, query, validationResult } = require("express-validator")
const { AppError } = require("../middleware/errorHandler")
const authMiddleware = require("../middleware/auth")
const uploadFields = require("../middleware/upload")
const { ProductController } = require("../controllers/productController")
const { ReboulProductController } = require("../controllers/reboulProductController")
const db = require('../db')

// Middleware de validation
const validateRequest = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return next(new AppError("Erreur de validation", 400, errors.array()))
  }
  next()
}

// GET tous les produits avec filtrage
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
    query("color").optional().isString(),
    query("size").optional().isString(),
    query("store_type").optional().isIn(["adult", "kids", "sneakers", "cpcompany"]),
    query("featured").optional().isBoolean(),
    query("search").optional().isString(),
    query("sort").optional().isIn(["name", "price"]).withMessage("Le tri doit être soit par nom, soit par prix"),
    query("order").optional().isIn(["asc", "desc"]).withMessage("L'ordre doit être asc ou desc"),
    query("fields").optional().isString().withMessage("Le format de fields doit être une chaîne de caractères (ex: 'id,name,price')"),
  ],
  validateRequest,
  async (req, res, next) => {
    console.log('--- REQUÊTE GET /api/products REÇUE ---')
    console.log('Query params bruts:', req.query)
    console.log('Type de brand_id:', typeof req.query.brand_id, 'Valeur:', req.query.brand_id)
    
    try {
      const result = await ReboulProductController.getAllReboulProducts(req, res, next)
      console.log('Résultat de la requête:', { 
        total: result.pagination.totalItems,
        page: result.pagination.currentPage
      })
      res.json(result)
    } catch (error) {
      console.error('Erreur lors de la récupération des produits:', error)
      console.error('Détails de l\'erreur:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      })
      res.status(500).json({
        error: 'Erreur lors de la récupération des produits',
        details: error.message
      })
    }
  }
)

// GET un produit par ID
router.get(
  "/:id",
  param("id").isInt().withMessage("L'ID du produit doit être un nombre entier"),
  validateRequest,
  async (req, res, next) => {
    try {
      const product = await ReboulProductController.getReboulProductById(req.params.id)
      res.json(product)
    } catch (err) {
      next(err)
    }
  }
)

// POST pour créer un nouveau produit
router.post(
  "/",
  authMiddleware,
  uploadFields,
  [
    body("name").notEmpty().withMessage("Le nom du produit est requis"),
    body("price").isFloat({ min: 0 }).withMessage("Le prix doit être un nombre positif"),
    body("description").optional().isString(),
    body("category_id").optional().isInt(),
    body("brand").optional().isString(),
    body("store_type").optional().isIn(["adult", "kids", "sneakers", "cpcompany"]),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const product = await ProductController.createProduct(req.body, req.files)
      res.status(201).json(product)
    } catch (err) {
      next(err)
    }
  }
)

// PUT pour mettre à jour un produit
router.put(
  "/:id",
  authMiddleware,
  uploadFields,
  [
    param("id").isInt().withMessage("L'ID du produit doit être un nombre entier"),
    body("name").optional().notEmpty().withMessage("Le nom du produit ne peut pas être vide"),
    body("price").optional().isFloat({ min: 0 }).withMessage("Le prix doit être un nombre positif"),
    body("description").optional().isString(),
    body("category_id").optional().isInt(),
    body("brand").optional().isString(),
    body("store_type").optional().isIn(["adult", "kids", "sneakers", "cpcompany"]),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const product = await ProductController.updateProduct(req.params.id, req.body, req.files)
      res.json(product)
    } catch (err) {
      next(err)
    }
  }
)

// DELETE pour supprimer un produit
router.delete(
  "/:id",
  authMiddleware,
  param("id").isInt().withMessage("L'ID du produit doit être un nombre entier"),
  validateRequest,
  async (req, res, next) => {
    try {
      const deletedProduct = await ProductController.deleteProduct(req.params.id)
      res.json({ message: "Produit supprimé avec succès", deletedProduct })
    } catch (err) {
      next(err)
    }
  }
)

// POST pour corriger les images de tous les produits
router.post(
  "/fix-all-images",
  authMiddleware,
  async (req, res, next) => {
    try {
      const result = await ProductController.fixAllProductImages();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST pour corriger les images d'un produit
router.post(
  "/:id/fix-images",
  authMiddleware,
  param("id").isInt().withMessage("L'ID du produit doit être un nombre entier"),
  validateRequest,
  async (req, res, next) => {
    try {
      const result = await ProductController.fixProductImages(req.params.id)
      res.json({
        message: "Images du produit corrigées avec succès",
        ...result
      })
    } catch (err) {
      next(err)
    }
  }
)

// POST pour mettre à jour le stock après validation d'une commande
router.post(
  "/update-stock",
  authMiddleware,
  [
    body("items").isArray().withMessage("Items doit être un tableau"),
    body("items.*.product_id").notEmpty().withMessage("product_id est requis pour chaque item"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("quantity doit être un nombre entier positif"),
    body("order_id").isInt().withMessage("order_id doit être un nombre entier")
  ],
  validateRequest,
  async (req, res, next) => {
    const client = await db.pool.connect();
    try {
      const { items, order_id } = req.body;
      console.log(`📦 Mise à jour du stock pour la commande #${order_id}`, items);
      
      await client.query('BEGIN');
      
      const results = {
        success: [],
        errors: [],
        summary: { updated: 0, failed: 0 }
      };
      
      for (const item of items) {
        try {
          const productId = parseInt(item.product_id);
          const quantity = parseInt(item.quantity);
          const variantInfo = item.variant_info || {};
          
          console.log(`🔍 Traitement produit ID: ${productId}, quantité: ${quantity}, table: ${item.store_table}`);
          
          // Utiliser la table spécifiée ou fallback vers recherche multiple
          let table = item.store_table || null;
          let product = null;
          
          if (table && ['corner_products', 'sneakers_products', 'minots_products', 'products'].includes(table)) {
            // Chercher directement dans la table spécifiée
            try {
              const result = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [productId]);
              if (result.rows.length > 0) {
                product = result.rows[0];
                console.log(`✅ Produit trouvé dans ${table} (ciblé): ${product.name}`);
              } else {
                console.warn(`⚠️ Produit ${productId} non trouvé dans la table ciblée ${table}`);
              }
            } catch (e) {
              console.error(`❌ Erreur recherche dans ${table}:`, e.message);
            }
          }
          
          // Si pas de table spécifiée ou pas trouvé, fallback vers recherche multiple
          if (!product) {
            console.log(`🔄 Recherche fallback dans toutes les tables pour ID: ${productId}`);
            
            // 1. Chercher dans corner_products
            try {
              const cornerResult = await client.query('SELECT * FROM corner_products WHERE id = $1', [productId]);
              if (cornerResult.rows.length > 0) {
                table = 'corner_products';
                product = cornerResult.rows[0];
              }
            } catch (e) {
              console.warn(`Erreur recherche corner_products:`, e.message);
            }
            
            // 2. Chercher dans sneakers_products
            if (!product) {
              try {
                const sneakersResult = await client.query('SELECT * FROM sneakers_products WHERE id = $1', [productId]);
                if (sneakersResult.rows.length > 0) {
                  table = 'sneakers_products';
                  product = sneakersResult.rows[0];
                }
              } catch (e) {
                console.warn(`Erreur recherche sneakers_products:`, e.message);
              }
            }
            
            // 3. Chercher dans minots_products
            if (!product) {
              try {
                const minotsResult = await client.query('SELECT * FROM minots_products WHERE id = $1', [productId]);
                if (minotsResult.rows.length > 0) {
                  table = 'minots_products';
                  product = minotsResult.rows[0];
                }
              } catch (e) {
                console.warn(`Erreur recherche minots_products:`, e.message);
              }
            }
            
            // 4. Chercher dans products (adult)
            if (!product) {
              try {
                const productsResult = await client.query('SELECT * FROM products WHERE id = $1', [productId]);
                if (productsResult.rows.length > 0) {
                  table = 'products';
                  product = productsResult.rows[0];
                }
              } catch (e) {
                console.warn(`Erreur recherche products:`, e.message);
              }
            }
          }
          
          if (!product) {
            console.error(`❌ Produit ${productId} non trouvé dans aucune table`);
            results.errors.push({ 
              product_id: productId, 
              error: `Produit non trouvé dans aucune table` 
            });
            results.summary.failed++;
            continue;
          }
          
          // Mettre à jour les variants si le produit en a
          if (product.variants && typeof product.variants === 'object') {
            const variants = Array.isArray(product.variants) ? product.variants : Object.values(product.variants);
            let variantUpdated = false;
            
            // Chercher le variant correspondant
            for (let variant of variants) {
              if (
                variant.size === variantInfo.size && 
                (variant.color === variantInfo.color || variant.colorLabel === variantInfo.color)
              ) {
                const newStock = Math.max(0, (variant.stock || 0) - quantity);
                variant.stock = newStock;
                variantUpdated = true;
                console.log(`✅ Stock variant mis à jour: ${variant.size}/${variant.color} → ${newStock}`);
                break;
              }
            }
            
            if (variantUpdated) {
              // Mettre à jour le JSON variants dans la base
              await client.query(
                `UPDATE ${table} SET variants = $1 WHERE id = $2`,
                [JSON.stringify(variants), productId]
              );
              
              results.success.push({
                product_id: productId,
                product_name: product.name,
                table: table,
                variant: `${variantInfo.size}/${variantInfo.color}`,
                quantity_reduced: quantity,
                message: `Stock variant mis à jour avec succès`
              });
              results.summary.updated++;
            } else {
              console.warn(`⚠️ Variant non trouvé pour ${product.name}: ${variantInfo.size}/${variantInfo.color}`);
              results.errors.push({
                product_id: productId,
                error: `Variant ${variantInfo.size}/${variantInfo.color} non trouvé`
              });
              results.summary.failed++;
            }
          } else {
            console.warn(`⚠️ Produit ${product.name} n'a pas de variants configurés`);
            results.errors.push({
              product_id: productId,
              error: `Produit sans système de variants`
            });
            results.summary.failed++;
          }
          
        } catch (itemError) {
          console.error(`❌ Erreur traitement item ${item.product_id}:`, itemError);
          results.errors.push({
            product_id: item.product_id,
            error: itemError.message
          });
          results.summary.failed++;
        }
      }
      
      await client.query('COMMIT');
      console.log(`✅ Mise à jour stock terminée:`, results.summary);
      
      res.json({
        success: true,
        message: `Stock mis à jour: ${results.summary.updated} succès, ${results.summary.failed} échecs`,
        summary: results.summary,
        details: results
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Erreur mise à jour stock:', error);
      next(error);
    } finally {
      client.release();
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