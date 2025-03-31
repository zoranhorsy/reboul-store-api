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

    // Appeler fixProductImages après la mise à jour
    await ProductController.fixProductImages(id);

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
          // Toujours utiliser la première image uploadée comme image_url
          productData.image_url = uploadedImages[0].url;
          
          // Stocker toutes les URLs des images dans le tableau images
          productData.images = uploadedImages.map(img => img.url);
        }
      } catch (error) {
        console.error('Erreur lors de l\'upload des images:', error);
        throw new AppError('Erreur lors de l\'upload des images', 500);
      }
    } else if (data.images) {
      let images = [];
      
      // Traitement des images existantes
      if (typeof data.images === 'string') {
        try {
          // Essayer de parser comme JSON
          images = JSON.parse(data.images);
        } catch (error) {
          // Si ce n'est pas du JSON valide, vérifier si c'est une URL unique
          if (data.images.includes('cloudinary.com')) {
            images = [data.images];
          } else {
            // Sinon, essayer de splitter sur les virgules
            images = data.images.split(',').map(url => url.trim());
          }
        }
      } else if (Array.isArray(data.images)) {
        images = data.images;
      }
      
      // Filtrer pour ne garder que les URLs Cloudinary valides
      const cloudinaryImages = images.filter(img => 
        typeof img === 'string' && 
        img.includes('cloudinary.com')
      );
      
      if (cloudinaryImages.length > 0) {
        // Toujours utiliser la première image comme image_url
        productData.image_url = cloudinaryImages[0];
        productData.images = cloudinaryImages;
      }
    }

    // Traiter les champs JSON
    const jsonFields = ["variants", "reviews", "questions", "faqs", "size_chart"]
    jsonFields.forEach(field => {
      if (productData[field]) {
        if (typeof productData[field] === 'string') {
          try {
            productData[field] = JSON.parse(productData[field]);
          } catch (e) {
            console.error(`Erreur lors du parsing du champ ${field}:`, e);
          }
        }
        // Convertir en JSONB pour PostgreSQL
        productData[field] = JSON.stringify(productData[field]);
      }
    });

    return productData;
  }

  static async _deleteProductImages(product) {
    try {
        // Extraire le public_id de l'URL Cloudinary de l'image principale
        if (product.image_url && product.image_url.includes('cloudinary.com')) {
            const publicId = product.image_url.split('/').slice(-1)[0].split('.')[0];
            await deleteFromCloudinary(`reboul-store/products/${publicId}`);
            console.log('Image principale supprimée de Cloudinary:', publicId);
        }

        // Supprimer les images additionnelles
        let images = [];
        try {
            images = typeof product.images === 'string' 
                ? JSON.parse(product.images) 
                : (Array.isArray(product.images) ? product.images : []);
        } catch (error) {
            console.error("Erreur lors du parsing des images:", error);
            images = [];
        }

        // Supprimer chaque image de Cloudinary
        for (const imageUrl of images) {
            if (typeof imageUrl === 'string' && imageUrl.includes('cloudinary.com')) {
                const publicId = imageUrl.split('/').slice(-1)[0].split('.')[0];
                await deleteFromCloudinary(`reboul-store/products/${publicId}`);
                console.log('Image supprimée de Cloudinary:', publicId);
            }
        }
    } catch (error) {
        console.error("Erreur lors de la suppression des images:", error);
        throw new AppError('Erreur lors de la suppression des images', 500);
    }
  }

  static async handleProductImages(files) {
    console.log('Début handleProductImages');
    console.log('Files reçus:', files);
    
    const uploadedImages = [];
    
    try {
        // Si on a une image principale, on l'upload en premier
        if (files["image_url"] && files["image_url"][0]) {
            console.log('Uploading main image:', files["image_url"][0]);
            const mainImage = await uploadToCloudinary(files["image_url"][0]);
            console.log('Main image uploaded:', mainImage);
            if (!mainImage || !mainImage.url) {
                throw new Error('Échec de l\'upload de l\'image principale');
            }
            uploadedImages.push(mainImage);
        }
        
        // Upload des images additionnelles
        if (files["images"]) {
            console.log('Uploading additional images');
            for (const file of files["images"]) {
                const result = await uploadToCloudinary(file);
                console.log('Additional image uploaded:', result);
                if (result && result.url) {
                    uploadedImages.push(result);
                } else {
                    console.error('Échec de l\'upload d\'une image additionnelle');
                }
            }
        }
        
        // Vérifier qu'on a au moins une image
        if (uploadedImages.length === 0) {
            throw new Error('Aucune image n\'a été uploadée avec succès');
        }
        
        // Si on n'a pas d'image principale mais qu'on a des images additionnelles,
        // on utilise la première image additionnelle comme image principale
        if (!files["image_url"] && uploadedImages.length > 0) {
            console.log('Using first additional image as main image');
            const [firstImage, ...restImages] = uploadedImages;
            return [firstImage, ...restImages];
        }
        
        console.log('Images uploadées:', uploadedImages);
        return uploadedImages;
    } catch (error) {
        console.error('Erreur lors de l\'upload des images:', error);
        // Si une erreur survient, essayer de supprimer les images déjà uploadées
        for (const image of uploadedImages) {
            if (image && image.public_id) {
                try {
                    await deleteFromCloudinary(image.public_id);
                    console.log('Image supprimée après erreur:', image.public_id);
                } catch (deleteError) {
                    console.error('Erreur lors de la suppression de l\'image après erreur:', deleteError);
                }
            }
        }
        throw error;
    }
  }

  // Ajouter cette nouvelle méthode avant updateProduct
  static async fixProductImages(id) {
    try {
        // 1. Récupérer le produit actuel
        const { rows } = await pool.query("SELECT images, image_url FROM products WHERE id = $1", [id]);
        if (rows.length === 0) {
            throw new AppError("Produit non trouvé", 404);
        }
        
        const product = rows[0];
        let needsUpdate = false;
        let images = [];
        let image_url = product.image_url;

        // 2. Parser et vérifier les images
        try {
            images = typeof product.images === 'string' 
                ? JSON.parse(product.images)
                : (Array.isArray(product.images) ? product.images : []);
        } catch (error) {
            console.error("Erreur lors du parsing des images:", error);
            images = [];
        }

        // 3. Filtrer pour ne garder que les URLs Cloudinary valides
        const cloudinaryImages = images.filter(img => 
            typeof img === 'string' && 
            img.includes('cloudinary.com')
        );

        // 4. Mettre à jour image_url si nécessaire
        if (cloudinaryImages.length > 0) {
            if (!image_url || !image_url.includes('cloudinary.com')) {
                image_url = cloudinaryImages[0];
                needsUpdate = true;
            }
        }

        // 5. Mettre à jour la base de données si nécessaire
        if (needsUpdate) {
            await pool.query(
                "UPDATE products SET image_url = $1, images = $2 WHERE id = $3",
                [image_url, JSON.stringify(cloudinaryImages), id]
            );
            console.log(`Images corrigées pour le produit ${id}:`, {
                image_url,
                images: cloudinaryImages
            });
        }

        return { image_url, images: cloudinaryImages };
    } catch (error) {
        console.error("Erreur lors de la correction des images:", error);
        throw error;
    }
  }

  // Méthode pour corriger les images de tous les produits
  static async fixAllProductImages() {
    try {
      // 1. Récupérer tous les produits qui ont besoin d'être corrigés
      const { rows: products } = await pool.query(
        "SELECT id, images, image_url FROM products WHERE image_url NOT LIKE '%cloudinary.com%' AND images IS NOT NULL"
      );

      console.log(`${products.length} produits à corriger trouvés`);

      const results = {
        success: [],
        errors: []
      };

      // 2. Pour chaque produit, corriger les images
      for (const product of products) {
        try {
          const result = await ProductController.fixProductImages(product.id);
          results.success.push({
            id: product.id,
            old_image_url: product.image_url,
            new_image_url: result.image_url
          });
        } catch (error) {
          console.error(`Erreur lors de la correction du produit ${product.id}:`, error);
          results.errors.push({
            id: product.id,
            error: error.message
          });
        }
      }

      return {
        message: "Correction des images terminée",
        total_products: products.length,
        corrected: results.success.length,
        failed: results.errors.length,
        details: results
      };
    } catch (error) {
      console.error("Erreur lors de la correction des images:", error);
      throw new AppError("Erreur lors de la correction des images", 500);
    }
  }
}

module.exports = { ProductController } 