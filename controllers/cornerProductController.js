const pool = require("../db")
const { AppError } = require("../middleware/errorHandler")
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary')

// Fonction utilitaire pour parser les champs JSON
const parseJsonField = (field, value) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch (e) {
      console.error(`Erreur lors du parsing du champ ${field}:`, e)
      return value
    }
  }
  return value
}

class CornerProductController {
  // Récupérer tous les produits de The Corner avec filtrage
  static async getAllCornerProducts(req) {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 50
    const offset = (page - 1) * limit

    const queryParams = []
    const whereConditions = []
    let paramIndex = 1

    // Fonction pour ajouter une condition
    const addCondition = (condition, value) => {
      whereConditions.push(condition)
      queryParams.push(value)
      return paramIndex++
    }

    // Ajout des conditions de filtrage
    if (req.query.category_id) {
      addCondition("category_id = $" + paramIndex, Number.parseInt(req.query.category_id))
    }

    // Utiliser brand_id comme filtre principal pour la marque
    if (req.query.brand_id) {
      const brandIdValue = Number.parseInt(req.query.brand_id)
      addCondition("brand_id = $" + paramIndex, brandIdValue)
    } 
    // Garder brand comme fallback pour rétrocompatibilité
    else if (req.query.brand) {
      addCondition("brand = $" + paramIndex, req.query.brand)
    }

    if (req.query.minPrice) {
      addCondition("price::numeric >= $" + paramIndex, Number.parseFloat(req.query.minPrice))
    }

    if (req.query.maxPrice) {
      addCondition("price::numeric <= $" + paramIndex, Number.parseFloat(req.query.maxPrice))
    }

    if (req.query.color) {
      addCondition(
        "EXISTS (SELECT 1 FROM jsonb_array_elements(variants) v WHERE LOWER(v->>'color') = $" + paramIndex + ")",
        req.query.color.toLowerCase()
      )
    }

    if (req.query.size) {
      addCondition("variants @> $" + paramIndex, JSON.stringify([{ size: req.query.size }]))
    }

    if (req.query.featured !== undefined) {
      addCondition("featured = $" + paramIndex, req.query.featured === "true")
    }

    if (req.query.search) {
      addCondition(
        "(name ILIKE $" + paramIndex + " OR description ILIKE $" + paramIndex + ")",
        "%" + req.query.search + "%"
      )
    }

    // Détermination du tri
    const sortColumn = req.query.sort === "price" ? "price::numeric" : "name"
    const sortOrder = req.query.order === "desc" ? "DESC" : "ASC"

    // Construction de la requête SQL
    let query = "SELECT *, variants FROM corner_products"
    if (whereConditions.length > 0) {
      query += " WHERE " + whereConditions.join(" AND ")
    }
    query += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`

    // Exécution des requêtes
    const { rows } = await pool.query(query, [...queryParams, limit, offset])
    
    let countQuery = "SELECT COUNT(*) FROM corner_products"
    if (whereConditions.length > 0) {
      countQuery += " WHERE " + whereConditions.join(" AND ")
    }
    const { rows: countRows } = await pool.query(countQuery, queryParams)
    const totalCount = Number.parseInt(countRows[0].count)

    return {
      data: rows,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    }
  }

  // Récupérer un produit de The Corner par ID
  static async getCornerProductById(id) {
    const { rows } = await pool.query("SELECT * FROM corner_products WHERE id = $1", [id])
    if (rows.length === 0) {
      throw new AppError("Produit The Corner non trouvé", 404)
    }
    return rows[0]
  }

  // Créer un nouveau produit The Corner
  static async createCornerProduct(data, files) {
    const productData = await CornerProductController._prepareProductData(data, files)
    
    const keys = Object.keys(productData)
    const values = Object.values(productData)
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ")

    const query = `
      INSERT INTO corner_products (${keys.join(", ")})
      VALUES (${placeholders})
      RETURNING *;
    `

    const { rows } = await pool.query(query, values)
    return rows[0]
  }

  // Mettre à jour un produit The Corner
  static async updateCornerProduct(id, data, files) {
    const updateFields = await CornerProductController._prepareProductData(data, files)
    
    const setClause = Object.keys(updateFields)
      .map((key, index) => {
        if (["variants", "reviews", "questions", "faqs", "size_chart"].includes(key)) {
          return `${key} = COALESCE($${index + 1}::jsonb, ${key})`
        }
        return `${key} = COALESCE($${index + 1}, ${key})`
      })
      .join(", ")
    
    const values = Object.values(updateFields)

    const query = `
      UPDATE corner_products
      SET ${setClause}
      WHERE id = $${values.length + 1}
      RETURNING *;
    `

    const result = await pool.query(query, [...values, id])
    if (result.rows.length === 0) {
      throw new AppError("Produit The Corner non trouvé", 404)
    }

    return result.rows[0]
  }

  // Supprimer un produit The Corner
  static async deleteCornerProduct(id) {
    // Vérifier si le produit est dans des commandes
    const { rows: orderCheck } = await pool.query(
      "SELECT EXISTS(SELECT 1 FROM order_items WHERE corner_product_id = $1)",
      [id]
    )

    if (orderCheck[0] && orderCheck[0].exists) {
      throw new AppError(
        "Ce produit The Corner ne peut pas être supprimé car il est référencé dans des commandes existantes.",
        400
      )
    }

    // Récupérer les informations du produit
    const { rows } = await pool.query("SELECT image_url, images FROM corner_products WHERE id = $1", [id])
    if (rows.length === 0) {
      throw new AppError("Produit The Corner non trouvé", 404)
    }

    // Supprimer le produit
    const deleteResult = await pool.query("DELETE FROM corner_products WHERE id = $1 RETURNING *", [id])
    
    // Supprimer les images associées si nécessaire
    await CornerProductController._deleteProductImages(rows[0])

    return deleteResult.rows[0]
  }

  // Méthodes privées utilitaires
  static async _prepareProductData(data, files) {
    const productData = { ...data }
    
    // Gestion des images avec Cloudinary (si utilisé)
    if (files && files.length > 0) {
      try {
        const uploadedImages = await CornerProductController.handleProductImages(files)
        
        if (uploadedImages.length > 0) {
          // Toujours utiliser la première image uploadée comme image_url
          productData.image_url = uploadedImages[0].url
          
          // Stocker toutes les URLs des images dans le tableau images
          productData.images = uploadedImages.map(img => img.url)
        }
      } catch (error) {
        console.error('Erreur lors de l\'upload des images:', error)
        throw new AppError('Erreur lors de l\'upload des images', 500)
      }
    } else if (data.images) {
      let images = []
      
      // Traitement des images existantes
      if (typeof data.images === 'string') {
        try {
          // Essayer de parser comme JSON
          images = JSON.parse(data.images)
        } catch (error) {
          // Si ce n'est pas du JSON valide, vérifier si c'est une URL unique
          if (data.images.includes('cloudinary.com')) {
            images = [data.images]
          } else {
            // Sinon, essayer de splitter sur les virgules
            images = data.images.split(',').map(url => url.trim())
          }
        }
      } else if (Array.isArray(data.images)) {
        images = data.images
      }
      
      productData.images = images
    }
    
    // Traitement des variants (tailles, couleurs, etc.)
    if (data.variants) {
      if (typeof data.variants === 'string') {
        try {
          productData.variants = JSON.parse(data.variants)
        } catch (error) {
          console.error('Erreur lors du parsing des variants:', error)
          throw new AppError('Format de variants invalide', 400)
        }
      }
    }
    
    // Traitement des détails (caractéristiques du produit)
    if (data.details) {
      if (typeof data.details === 'string') {
        try {
          productData.details = JSON.parse(data.details)
        } catch (error) {
          // Si ce n'est pas du JSON valide, essayer de splitter
          productData.details = data.details.split(',').map(detail => detail.trim())
        }
      }
    }
    
    // Traitement des tags
    if (data.tags) {
      if (typeof data.tags === 'string') {
        try {
          productData.tags = JSON.parse(data.tags)
        } catch (error) {
          // Si ce n'est pas du JSON valide, essayer de splitter
          productData.tags = data.tags.split(',').map(tag => tag.trim())
        }
      }
    }
    
    return productData
  }

  static async _deleteProductImages(product) {
    // Si l'application utilise Cloudinary, supprimer les images
    if (product.image_url) {
      try {
        await deleteFromCloudinary(product.image_url)
      } catch (error) {
        console.error('Erreur lors de la suppression de l\'image principale:', error)
      }
    }
    
    if (product.images && Array.isArray(product.images)) {
      for (const imageUrl of product.images) {
        try {
          await deleteFromCloudinary(imageUrl)
        } catch (error) {
          console.error(`Erreur lors de la suppression de l'image ${imageUrl}:`, error)
        }
      }
    }
  }

  static async handleProductImages(files) {
    const uploadedImages = []
    
    // Si files est un objet avec des propriétés pour chaque type d'image
    if (files && typeof files === 'object' && !Array.isArray(files)) {
      for (const fieldName in files) {
        const fileArray = Array.isArray(files[fieldName]) ? files[fieldName] : [files[fieldName]]
        
        for (const file of fileArray) {
          try {
            const result = await uploadToCloudinary(file.path)
            uploadedImages.push({
              url: result.secure_url,
              publicId: result.public_id
            })
          } catch (error) {
            console.error(`Erreur lors de l'upload de l'image ${file.path}:`, error)
          }
        }
      }
    } 
    // Si files est un tableau d'objets file
    else if (Array.isArray(files)) {
      for (const file of files) {
        try {
          const result = await uploadToCloudinary(file.path)
          uploadedImages.push({
            url: result.secure_url,
            publicId: result.public_id
          })
        } catch (error) {
          console.error(`Erreur lors de l'upload de l'image ${file.path}:`, error)
        }
      }
    }
    
    return uploadedImages
  }
}

module.exports = { CornerProductController } 