const CornerProductVariant = require('../models/CornerProductVariant')
const { AppError } = require('../middleware/errorHandler')

class CornerProductVariantController {
  // Récupérer tous les variants d'un produit
  static async getVariants(req, res, next) {
    try {
      const productId = parseInt(req.params.productId)
      const variants = await CornerProductVariant.getByProductId(productId)
      res.json(variants)
    } catch (error) {
      next(error)
    }
  }

  // Créer un nouveau variant
  static async createVariant(req, res, next) {
    try {
      const productId = parseInt(req.params.productId)
      const variantData = {
        ...req.body,
        corner_product_id: productId
      }
      
      const variant = await CornerProductVariant.create(variantData)
      res.status(201).json(variant)
    } catch (error) {
      next(error)
    }
  }

  // Mettre à jour un variant
  static async updateVariant(req, res, next) {
    try {
      const variantId = parseInt(req.params.variantId)
      const variant = await CornerProductVariant.update(variantId, req.body)
      res.json(variant)
    } catch (error) {
      next(error)
    }
  }

  // Supprimer un variant
  static async deleteVariant(req, res, next) {
    try {
      const variantId = parseInt(req.params.variantId)
      const variant = await CornerProductVariant.delete(variantId)
      res.json({
        message: 'Variant supprimé avec succès',
        variant
      })
    } catch (error) {
      next(error)
    }
  }

  // Mettre à jour le stock d'un variant
  static async updateVariantStock(req, res, next) {
    try {
      const variantId = parseInt(req.params.variantId)
      const { quantity } = req.body

      if (typeof quantity !== 'number') {
        throw new AppError('La quantité doit être un nombre', 400)
      }

      const variant = await CornerProductVariant.updateStock(variantId, quantity)
      res.json(variant)
    } catch (error) {
      next(error)
    }
  }

  // Récupérer les couleurs disponibles pour un produit
  static async getAvailableColors(req, res, next) {
    try {
      const productId = parseInt(req.params.productId)
      const colors = await CornerProductVariant.getAvailableColors(productId)
      res.json(colors)
    } catch (error) {
      next(error)
    }
  }

  // Récupérer les tailles disponibles pour un produit
  static async getAvailableSizes(req, res, next) {
    try {
      const productId = parseInt(req.params.productId)
      const sizes = await CornerProductVariant.getAvailableSizes(productId)
      res.json(sizes)
    } catch (error) {
      next(error)
    }
  }
}

module.exports = CornerProductVariantController 