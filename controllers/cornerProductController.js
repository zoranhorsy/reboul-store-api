const pool = require("../db")
const { AppError } = require("../middleware/errorHandler")
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary')
const CornerProductVariant = require('../models/CornerProductVariant')

// Validation des prix
const validatePrices = (price, old_price) => {
  const numPrice = Number(price);
  const numOldPrice = old_price ? Number(old_price) : null;

  if (isNaN(numPrice) || numPrice <= 0) {
    throw new AppError("Le prix doit être un nombre positif", 400);
  }

  if (numOldPrice !== null) {
    if (isNaN(numOldPrice) || numOldPrice <= 0) {
      throw new AppError("L'ancien prix doit être un nombre positif", 400);
    }
    if (numOldPrice <= numPrice) {
      throw new AppError("L'ancien prix doit être supérieur au prix actuel", 400);
    }
  }

  return { price: numPrice, old_price: numOldPrice };
}

// Validation des variants
const validateVariants = (variants) => {
  if (!Array.isArray(variants)) {
    throw new AppError("Les variants doivent être un tableau", 400);
  }

  return variants.map(variant => {
    if (!variant.color || !variant.size || typeof variant.stock !== 'number') {
      throw new AppError("Chaque variant doit avoir une couleur, une taille et un stock", 400);
    }

    if (variant.stock < 0) {
      throw new AppError("Le stock ne peut pas être négatif", 400);
    }

    return {
      color: variant.color.trim(),
      size: variant.size.trim(),
      stock: variant.stock
    };
  });
}

class CornerProductController {
  // Récupérer tous les produits de The Corner avec filtrage
  static async getAllCornerProducts(req) {
    try {
      const page = Number.parseInt(req.query.page) || 1
      const limit = Number.parseInt(req.query.limit) || 50
      const offset = (page - 1) * limit

      const queryParams = []
      const whereConditions = ["corner_products.active = true"]
      let paramIndex = 1

      // Fonction pour ajouter une condition
      const addCondition = (condition, value) => {
        whereConditions.push(condition)
        queryParams.push(value)
        return paramIndex++
      }

      // Ajout des conditions de filtrage
      if (req.query.category_id) {
        addCondition("corner_products.category_id = $" + paramIndex, Number.parseInt(req.query.category_id))
      }

      if (req.query.brand_id) {
        addCondition("corner_products.brand_id = $" + paramIndex, Number.parseInt(req.query.brand_id))
      } else if (req.query.brand) {
        addCondition("corner_products.brand = $" + paramIndex, req.query.brand)
      }

      if (req.query.minPrice) {
        addCondition("corner_products.price::numeric >= $" + paramIndex, Number.parseFloat(req.query.minPrice))
      }

      if (req.query.maxPrice) {
        addCondition("corner_products.price::numeric <= $" + paramIndex, Number.parseFloat(req.query.maxPrice))
      }

      if (req.query.featured !== undefined) {
        addCondition("corner_products.featured = $" + paramIndex, req.query.featured === "true")
      }

      if (req.query.search) {
        const searchTerm = "%" + req.query.search + "%"
        addCondition(
          "(corner_products.name ILIKE $" + paramIndex + " OR corner_products.description ILIKE $" + paramIndex + ")",
          searchTerm
        )
      }

      // Filtrage par couleur et taille
      if (req.query.color) {
        addCondition("EXISTS (SELECT 1 FROM corner_product_variants WHERE corner_product_variants.corner_product_id = corner_products.id AND corner_product_variants.couleur = $" + paramIndex + " AND corner_product_variants.active = true)", req.query.color)
      }

      if (req.query.size) {
        addCondition("EXISTS (SELECT 1 FROM corner_product_variants WHERE corner_product_variants.corner_product_id = corner_products.id AND corner_product_variants.taille = $" + paramIndex + " AND corner_product_variants.active = true)", req.query.size)
      }

      // Vérification du stock disponible
      if (req.query.inStock === 'true') {
        whereConditions.push("EXISTS (SELECT 1 FROM corner_product_variants WHERE corner_product_variants.corner_product_id = corner_products.id AND corner_product_variants.stock > 0 AND corner_product_variants.active = true)")
      }

      // Détermination du tri
      const sortColumn = req.query.sort === "price" ? "corner_products.price::numeric" : "corner_products.name"
      const sortOrder = req.query.order === "desc" ? "DESC" : "ASC"

      // Construction de la requête SQL
      const query = `
        WITH product_data AS (
          SELECT 
            corner_products.*,
            json_agg(
              json_build_object(
                'id', corner_product_variants.id,
                'taille', corner_product_variants.taille,
                'couleur', corner_product_variants.couleur,
                'stock', corner_product_variants.stock,
                'price', corner_product_variants.price
              )
            ) FILTER (WHERE corner_product_variants.id IS NOT NULL) as variants
          FROM corner_products
          LEFT JOIN corner_product_variants ON corner_products.id = corner_product_variants.corner_product_id AND corner_product_variants.active = true
          WHERE ${whereConditions.join(" AND ")}
          GROUP BY corner_products.id
        )
        SELECT *
        FROM product_data
        ORDER BY ${sortColumn} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `

      const countQuery = `
        SELECT COUNT(DISTINCT corner_products.id)
        FROM corner_products
        LEFT JOIN corner_product_variants ON corner_products.id = corner_product_variants.corner_product_id AND corner_product_variants.active = true
        WHERE ${whereConditions.join(" AND ")}
      `

      const [products, count] = await Promise.all([
        pool.query(query, [...queryParams, limit, offset]),
        pool.query(countQuery, queryParams)
      ])

      return {
        data: products.rows.map(product => ({
          ...product,
          variants: product.variants || []
        })),
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalItems: parseInt(count.rows[0].count),
          totalPages: Math.ceil(parseInt(count.rows[0].count) / limit)
        }
      }
    } catch (error) {
      console.error('Erreur dans getAllCornerProducts:', error);
      throw error;
    }
  }

  // Récupérer un produit de The Corner par ID
  static async getCornerProductById(id) {
    const query = `
      SELECT 
        cp.*,
        json_agg(
          json_build_object(
            'id', cpv.id,
            'taille', cpv.taille,
            'couleur', cpv.couleur,
            'stock', cpv.stock,
            'price', cpv.price
          )
        ) FILTER (WHERE cpv.id IS NOT NULL) as variants
      FROM corner_products cp
      LEFT JOIN corner_product_variants cpv ON cp.id = cpv.corner_product_id AND cpv.active = true
      WHERE cp.id = $1 AND cp.active = true
      GROUP BY cp.id
    `

    const { rows } = await pool.query(query, [id])
    
    if (rows.length === 0) {
      throw new AppError("Produit non trouvé", 404)
    }

    return {
      ...rows[0],
      variants: rows[0].variants || []
    }
  }

  // Créer un nouveau produit The Corner
  static async createCornerProduct(data, files) {
    try {
      // Validation des prix
      const { price, old_price } = validatePrices(data.price, data.old_price);

      // Validation des variants si présents
      let variants = [];
      if (data.variants) {
        variants = validateVariants(
          typeof data.variants === 'string' ? JSON.parse(data.variants) : data.variants
        );
      }

      // Préparation des données du produit
      const productData = {
        name: data.name.trim(),
        description: data.description?.trim(),
        price,
        old_price,
        category_id: data.category_id,
        brand_id: data.brand_id,
        brand: data.brand?.trim(),
        featured: Boolean(data.featured),
        active: true,
        new: Boolean(data.new),
        sku: data.sku?.trim(),
        store_reference: data.store_reference?.trim(),
        material: data.material?.trim(),
        weight: data.weight ? Number(data.weight) : null,
        dimensions: data.dimensions?.trim()
      };

      // Gestion des images
      if (files && files.length > 0) {
        const uploadedImages = await Promise.all(
          files.map(file => uploadToCloudinary(file.path))
        );

        productData.image_url = uploadedImages[0].secure_url;
        productData.images = uploadedImages.map(img => img.secure_url);
      }

      // Insertion dans la base de données
      const columns = Object.keys(productData);
      const values = Object.values(productData);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const query = `
        INSERT INTO corner_products (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;

      const { rows } = await pool.query(query, values);

      // Création des variants si fournis
      if (data.variants && Array.isArray(data.variants)) {
        await Promise.all(
          data.variants.map(variant => 
            CornerProductVariant.create({
              ...variant,
              corner_product_id: rows[0].id,
              product_name: rows[0].name
            })
          )
        );
      }

      // Récupérer le produit avec ses variants
      return await CornerProductController.getCornerProductById(rows[0].id);
    } catch (error) {
      // Si une erreur survient, supprimer les images uploadées
      if (error.uploadedImages) {
        await Promise.all(
          error.uploadedImages.map(img => deleteFromCloudinary(img.public_id))
        );
      }
      throw error;
    }
  }

  // Mettre à jour un produit The Corner
  static async updateCornerProduct(id, data, files) {
    try {
      // Vérifier si le produit existe
      const existingProduct = await CornerProductController.getCornerProductById(id);
      if (!existingProduct) {
        throw new AppError("Produit non trouvé", 404);
      }

      // Validation des prix si fournis
      let priceData = {};
      if (data.price || data.old_price) {
        priceData = validatePrices(
          data.price || existingProduct.price,
          data.old_price
        );
      }

      // Validation des variants si fournis
      let variants = existingProduct.variants;
      if (data.variants) {
        variants = validateVariants(
          typeof data.variants === 'string' ? JSON.parse(data.variants) : data.variants
        );
      }

      // Préparation des données à mettre à jour
      const updateData = {
        ...data,
        ...priceData,
        updated_at: new Date()
      };

      // Gestion des nouvelles images
      if (files && files.length > 0) {
        const uploadedImages = await Promise.all(
          files.map(file => uploadToCloudinary(file.path))
        );

        updateData.image_url = uploadedImages[0].secure_url;
        updateData.images = uploadedImages.map(img => img.secure_url);

        // Supprimer les anciennes images
        if (existingProduct.images) {
          await Promise.all(
            existingProduct.images.map(img => deleteFromCloudinary(img))
          );
        }
      }

      // Construction de la requête de mise à jour
      const updates = Object.keys(updateData)
        .map((key, i) => `${key} = $${i + 1}`)
        .join(', ');

      const query = `
        UPDATE corner_products
        SET ${updates}
        WHERE id = $${Object.keys(updateData).length + 1}
        RETURNING *
      `;

      const values = [...Object.values(updateData), id];
      const { rows } = await pool.query(query, values);

      // Mise à jour des variants si fournis
      if (data.variants && Array.isArray(data.variants)) {
        // Supprimer les variants existants
        await pool.query(
          'UPDATE corner_product_variants SET active = false WHERE corner_product_id = $1',
          [id]
        );

        // Créer les nouveaux variants
        await Promise.all(
          data.variants.map(variant => 
            CornerProductVariant.create({
              ...variant,
              corner_product_id: id,
              product_name: rows[0].name
            })
          )
        );
      }

      // Récupérer le produit mis à jour avec ses variants
      return await CornerProductController.getCornerProductById(id);
    } catch (error) {
      if (error.uploadedImages) {
        await Promise.all(
          error.uploadedImages.map(img => deleteFromCloudinary(img.public_id))
        );
      }
      throw error;
    }
  }

  // Supprimer un produit The Corner
  static async deleteCornerProduct(id) {
    // Vérifier si le produit est dans des commandes
    const { rows: orderCheck } = await pool.query(
      "SELECT EXISTS(SELECT 1 FROM order_items WHERE corner_product_id = $1)",
      [id]
    )

    if (orderCheck[0].exists) {
      // Au lieu de supprimer, marquer comme inactif
      const { rows } = await pool.query(
        "UPDATE corner_products SET active = false, _actiontype = 'delete' WHERE id = $1 RETURNING *",
        [id]
      );
      return rows[0];
    }

    // Si pas de commandes, supprimer complètement
    const { rows } = await pool.query(
      "SELECT image_url, images FROM corner_products WHERE id = $1",
      [id]
    );

    if (rows.length === 0) {
      throw new AppError("Produit The Corner non trouvé", 404);
    }

    // Supprimer les images
    const product = rows[0];
    if (product.image_url) {
      await deleteFromCloudinary(product.image_url);
    }
    if (product.images) {
      await Promise.all(product.images.map(img => deleteFromCloudinary(img)));
    }

    // Supprimer le produit
    const deleteResult = await pool.query(
      "DELETE FROM corner_products WHERE id = $1 RETURNING *",
      [id]
    );

    return deleteResult.rows[0];
  }

  // Méthode pour mettre à jour le stock d'un variant
  static async updateVariantStock(productId, variantData) {
    const { color, size, quantity } = variantData;

    if (quantity < 0) {
      throw new AppError("La quantité ne peut pas être négative", 400);
    }

    const { rows: [product] } = await pool.query(
      "SELECT variants FROM corner_products WHERE id = $1",
      [productId]
    );

    if (!product) {
      throw new AppError("Produit non trouvé", 404);
    }

    let variants = product.variants || [];
    const variantIndex = variants.findIndex(
      v => v.color === color && v.size === size
    );

    if (variantIndex === -1) {
      throw new AppError("Variant non trouvé", 404);
    }

    variants[variantIndex].stock = quantity;

    const { rows } = await pool.query(
      "UPDATE corner_products SET variants = $1 WHERE id = $2 RETURNING *",
      [JSON.stringify(variants), productId]
    );

    return rows[0];
  }
}

module.exports = { CornerProductController } 