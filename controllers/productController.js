const pool = require("../db")
const { AppError } = require("../middleware/errorHandler")
const path = require("path")
const fs = require("fs").promises
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

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

class ProductController {
  // Récupérer tous les produits avec filtrage
  static async getAllProducts(req) {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
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

    if (req.query.brand) {
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

    if (req.query.store_type) {
      addCondition("store_type = $" + paramIndex, req.query.store_type)
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
    let query = "SELECT *, variants FROM products"
    if (whereConditions.length > 0) {
      query += " WHERE " + whereConditions.join(" AND ")
    }
    query += ` ORDER BY ${sortColumn} ${sortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`

    // Exécution des requêtes
    const { rows } = await pool.query(query, [...queryParams, limit, offset])
    
    let countQuery = "SELECT COUNT(*) FROM products"
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

  // Récupérer un produit par ID
  static async getProductById(id) {
    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [id])
    if (rows.length === 0) {
      throw new AppError("Produit non trouvé", 404)
    }
    return rows[0]
  }

  // Créer un nouveau produit
  static async createProduct(data, files) {
    const productData = await ProductController._prepareProductData(data, files)
    
    const keys = Object.keys(productData)
    const values = Object.values(productData)
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(", ")

    const query = `
      INSERT INTO products (${keys.join(", ")})
      VALUES (${placeholders})
      RETURNING *;
    `

    const { rows } = await pool.query(query, values)
    return rows[0]
  }

  // Mettre à jour un produit
  static async updateProduct(id, data, files) {
    const updateFields = await ProductController._prepareProductData(data, files)
    
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
      UPDATE products
      SET ${setClause}
      WHERE id = $${values.length + 1}
      RETURNING *;
    `

    const result = await pool.query(query, [...values, id])
    if (result.rows.length === 0) {
      throw new AppError("Produit non trouvé", 404)
    }
    return result.rows[0]
  }

  // Supprimer un produit
  static async deleteProduct(id) {
    // Vérifier si le produit est dans des commandes
    const { rows: orderCheck } = await pool.query(
      "SELECT EXISTS(SELECT 1 FROM order_items WHERE product_id = $1)",
      [id]
    )

    if (orderCheck[0] && orderCheck[0].exists) {
      throw new AppError(
        "Ce produit ne peut pas être supprimé car il est référencé dans des commandes existantes.",
        400
      )
    }

    // Récupérer les informations du produit
    const { rows } = await pool.query("SELECT image_url, images FROM products WHERE id = $1", [id])
    if (rows.length === 0) {
      throw new AppError("Produit non trouvé", 404)
    }

    // Supprimer le produit
    const deleteResult = await pool.query("DELETE FROM products WHERE id = $1 RETURNING *", [id])
    
    // Supprimer les images associées
    await ProductController._deleteProductImages(rows[0])

    return deleteResult.rows[0]
  }

  // Méthodes privées utilitaires rendues statiques
  static async _prepareProductData(data, files) {
    const productData = { ...data }
    
    // Gestion des images avec Cloudinary
    if (files) {
      try {
        const uploadedImages = await ProductController.handleProductImages(files);
        
        if (uploadedImages.length > 0) {
          if (files["image_url"]) {
            productData.image_url = uploadedImages[0].url;
          }
          if (files["images"]) {
            productData.images = JSON.stringify(
              uploadedImages
                .slice(files["image_url"] ? 1 : 0)
                .map(img => img.url)
            );
          }
        }
      } catch (error) {
        console.error('Erreur lors de l\'upload des images:', error);
        throw new AppError('Erreur lors de l\'upload des images', 500);
      }
    }

    // Traiter les champs JSON et tableaux
    const jsonFields = ["variants", "reviews", "questions", "faqs", "size_chart"]
    const arrayFields = ["tags", "colors", "images"]

    jsonFields.forEach(field => {
      if (productData[field]) {
        productData[field] = JSON.stringify(parseJsonField(field, productData[field]))
      }
    })

    arrayFields.forEach(field => {
      if (productData[field] && !jsonFields.includes(field)) {
        if (Array.isArray(productData[field])) {
          productData[field] = `{${productData[field].join(",")}}`
        } else if (typeof productData[field] === "string" && field !== "images") {
          productData[field] = `{${productData[field]}}`
        }
      }
    })

    return productData
  }

  static async _deleteProductImages(product) {
    if (product.image_url) {
      const imagePath = path.join(__dirname, "..", "public", product.image_url)
      await fs.unlink(imagePath).catch(err => console.error("Erreur lors de la suppression de l'image principale:", err))
    }

    let images = []
    try {
      images = JSON.parse(product.images || "[]")
    } catch (error) {
      console.error("Erreur lors du parsing des images:", error)
    }

    for (const image of images) {
      const imagePath = path.join(__dirname, "..", "public", image)
      await fs.unlink(imagePath).catch(err => console.error("Erreur lors de la suppression d'une image:", err))
    }
  }

  static async handleProductImages(files) {
    console.log('Début handleProductImages');
    console.log('Files reçus:', files);
    
    const uploadedImages = [];
    
    if (files["image_url"]) {
      console.log('Uploading main image:', files["image_url"][0]);
      const mainImage = await uploadToCloudinary(files["image_url"][0]);
      console.log('Main image uploaded:', mainImage);
      uploadedImages.push(mainImage);
    }
    
    if (files["images"]) {
      console.log('Uploading additional images');
      for (const file of files["images"]) {
        const result = await uploadToCloudinary(file);
        console.log('Additional image uploaded:', result);
        uploadedImages.push(result);
      }
    }
    
    console.log('Images uploadées:', uploadedImages);
    return uploadedImages;
  }
}

module.exports = { ProductController } 