const pool = require('../db')
const { AppError } = require('../middleware/errorHandler')

class CornerProductVariant {
  static async getByProductId(productId) {
    const { rows } = await pool.query(
      `SELECT * FROM corner_product_variants 
       WHERE corner_product_id = $1 AND active = true 
       ORDER BY taille, couleur`,
      [productId]
    )
    return rows
  }

  static async create(variantData) {
    const {
      corner_product_id,
      taille,
      couleur,
      stock,
      product_name,
      store_reference,
      category_id,
      brand_id,
      price,
    } = variantData

    const { rows } = await pool.query(
      `INSERT INTO corner_product_variants (
        corner_product_id, taille, couleur, stock, product_name,
        store_reference, category_id, brand_id, price
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        corner_product_id,
        taille,
        couleur,
        stock || 0,
        product_name,
        store_reference,
        category_id,
        brand_id,
        price,
      ]
    )

    // Mettre à jour has_variants sur le produit parent
    await pool.query(
      'UPDATE corner_products SET has_variants = true WHERE id = $1',
      [corner_product_id]
    )

    return rows[0]
  }

  static async update(id, variantData) {
    const allowedFields = [
      'taille',
      'couleur',
      'stock',
      'product_name',
      'store_reference',
      'category_id',
      'brand_id',
      'price',
      'active',
    ]

    const updates = []
    const values = []
    let paramCount = 1

    Object.keys(variantData).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramCount}`)
        values.push(variantData[key])
        paramCount++
      }
    })

    if (updates.length === 0) {
      throw new AppError('Aucun champ valide à mettre à jour', 400)
    }

    values.push(id)

    const { rows } = await pool.query(
      `UPDATE corner_product_variants 
       SET ${updates.join(', ')} 
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    )

    if (rows.length === 0) {
      throw new AppError('Variant non trouvé', 404)
    }

    return rows[0]
  }

  static async delete(id) {
    const { rows } = await pool.query(
      'DELETE FROM corner_product_variants WHERE id = $1 RETURNING *',
      [id]
    )

    if (rows.length === 0) {
      throw new AppError('Variant non trouvé', 404)
    }

    // Vérifier s'il reste des variants pour le produit
    const { rows: remainingVariants } = await pool.query(
      'SELECT COUNT(*) FROM corner_product_variants WHERE corner_product_id = $1',
      [rows[0].corner_product_id]
    )

    if (parseInt(remainingVariants[0].count) === 0) {
      // Mettre à jour has_variants sur le produit parent
      await pool.query(
        'UPDATE corner_products SET has_variants = false WHERE id = $1',
        [rows[0].corner_product_id]
      )
    }

    return rows[0]
  }

  static async updateStock(id, quantity) {
    if (quantity < 0) {
      throw new AppError('La quantité ne peut pas être négative', 400)
    }

    const { rows } = await pool.query(
      'UPDATE corner_product_variants SET stock = $1 WHERE id = $2 RETURNING *',
      [quantity, id]
    )

    if (rows.length === 0) {
      throw new AppError('Variant non trouvé', 404)
    }

    return rows[0]
  }

  static async getAvailableColors(productId) {
    const { rows } = await pool.query(
      `SELECT DISTINCT couleur 
       FROM corner_product_variants 
       WHERE corner_product_id = $1 AND active = true 
       ORDER BY couleur`,
      [productId]
    )
    return rows.map(row => row.couleur)
  }

  static async getAvailableSizes(productId) {
    const { rows } = await pool.query(
      `SELECT DISTINCT taille 
       FROM corner_product_variants 
       WHERE corner_product_id = $1 AND active = true 
       ORDER BY taille`,
      [productId]
    )
    return rows.map(row => row.taille)
  }
} 