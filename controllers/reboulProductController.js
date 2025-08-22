const pool = require("../db")
const { AppError } = require("../middleware/errorHandler")

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

class ReboulProductController {
  // Récupérer tous les produits Reboul avec filtrage multi-tables
  static async getAllReboulProducts(req) {
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

    // Déterminer quelle(s) table(s) utiliser selon le store_type
    const storeType = req.query.store_type

    let query = ""
    let countQuery = ""

    // Construction des conditions communes (sans store_type)
    const commonConditions = []
    
    // Toujours filtrer sur les produits actifs
    commonConditions.push(`active = true`)
    
    if (req.query.category_id) {
      commonConditions.push(`category_id = $${paramIndex}`)
      queryParams.push(Number.parseInt(req.query.category_id))
      paramIndex++
    }

    if (req.query.brand_id) {
      commonConditions.push(`brand_id = $${paramIndex}`)
      queryParams.push(Number.parseInt(req.query.brand_id))
      paramIndex++
    } else if (req.query.brand) {
      commonConditions.push(`brand = $${paramIndex}`)
      queryParams.push(req.query.brand)
      paramIndex++
    }

    if (req.query.minPrice) {
      commonConditions.push(`price::numeric >= $${paramIndex}`)
      queryParams.push(Number.parseFloat(req.query.minPrice))
      paramIndex++
    }

    if (req.query.maxPrice) {
      commonConditions.push(`price::numeric <= $${paramIndex}`)
      queryParams.push(Number.parseFloat(req.query.maxPrice))
      paramIndex++
    }

    if (req.query.featured !== undefined) {
      commonConditions.push(`featured = $${paramIndex}`)
      queryParams.push(req.query.featured === "true")
      paramIndex++
    }

    if (req.query.search) {
      commonConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`)
      queryParams.push("%" + req.query.search + "%")
      paramIndex++
    }

    // Détermination du tri
    const sortColumn = req.query.sort === "price" ? "price::numeric" : "name"
    const sortOrder = req.query.order === "desc" ? "DESC" : "ASC"

    // Construction de la requête selon le store_type
    if (storeType === "adult") {
      // Chercher uniquement dans products (adultes)
      const conditions = [...commonConditions, "store_type = 'adult'"]
      const whereClause = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : ""
      
      query = `
        SELECT *, store_type, 'products' as source_table 
        FROM products 
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder} 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `
      
      countQuery = `
        SELECT COUNT(*) 
        FROM products 
        ${whereClause}
      `
      
    } else if (storeType === "sneakers") {
      // Chercher uniquement dans sneakers_products
      const whereClause = commonConditions.length > 0 ? " WHERE " + commonConditions.join(" AND ") : ""
      
      query = `
        SELECT *, 'sneakers' as store_type, 'sneakers_products' as source_table 
        FROM sneakers_products 
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder} 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `
      
      countQuery = `
        SELECT COUNT(*) 
        FROM sneakers_products 
        ${whereClause}
      `
      
    } else if (storeType === "kids") {
      // Chercher uniquement dans minots_products
      const whereClause = commonConditions.length > 0 ? " WHERE " + commonConditions.join(" AND ") : ""
      
      query = `
        SELECT *, 'kids' as store_type, 'minots_products' as source_table 
        FROM minots_products 
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder} 
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `
      
      countQuery = `
        SELECT COUNT(*) 
        FROM minots_products 
        ${whereClause}
      `
      
    }

    // Cas spécial : pas de store_type spécifique, traitement à part
    if (!storeType) {
      return await this.getAllReboulProductsCombined(commonConditions, queryParams, page, limit, sortColumn, sortOrder)
    }

    console.log("Query:", query)
    console.log("Params:", [...queryParams, limit, offset])

    try {
      // Exécution des requêtes
      const { rows } = await pool.query(query, [...queryParams, limit, offset])
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
    } catch (error) {
      console.error("Erreur lors de la récupération des produits Reboul:", error)
      throw new AppError("Erreur lors de la récupération des produits", 500)
    }
  }

  // Méthode pour récupérer tous les produits Reboul (combiné)
  static async getAllReboulProductsCombined(commonConditions, queryParams, page, limit, sortColumn, sortOrder) {
    const offset = (page - 1) * limit
    
    try {
      const whereClause = commonConditions.length > 0 ? " WHERE " + commonConditions.join(" AND ") : ""
      
      // Récupérer les données de chaque table séparément
      const adultQuery = `
        SELECT *, store_type, 'products' as source_table 
        FROM products 
        WHERE store_type = 'adult' ${commonConditions.length > 0 ? " AND " + commonConditions.join(" AND ") : ""}
        ORDER BY ${sortColumn} ${sortOrder}
      `
      
      const sneakersQuery = `
        SELECT *, 'sneakers' as store_type, 'sneakers_products' as source_table 
        FROM sneakers_products 
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}
      `
      
      const minotsQuery = `
        SELECT *, 'kids' as store_type, 'minots_products' as source_table 
        FROM minots_products 
        ${whereClause}
        ORDER BY ${sortColumn} ${sortOrder}
      `
      
      console.log("Requêtes combinées:", { adultQuery, sneakersQuery, minotsQuery })
      console.log("Params:", queryParams)
      
      // Exécuter les 3 requêtes en parallèle
      const [adultResult, sneakersResult, minotsResult] = await Promise.all([
        pool.query(adultQuery, queryParams),
        pool.query(sneakersQuery, queryParams),
        pool.query(minotsQuery, queryParams)
      ])
      
      // Combiner les résultats
      const allRows = [
        ...adultResult.rows,
        ...sneakersResult.rows,
        ...minotsResult.rows
      ]
      
      console.log("Résultats combinés:", {
        adult: adultResult.rows.length,
        sneakers: sneakersResult.rows.length,
        minots: minotsResult.rows.length,
        total: allRows.length
      })
      
      // Trier les résultats combinés
      allRows.sort((a, b) => {
        if (sortColumn === "price::numeric") {
          return sortOrder === "ASC" ? 
            parseFloat(a.price) - parseFloat(b.price) : 
            parseFloat(b.price) - parseFloat(a.price)
        } else {
          return sortOrder === "ASC" ? 
            a.name.localeCompare(b.name) : 
            b.name.localeCompare(a.name)
        }
      })
      
      // Appliquer la pagination
      const startIndex = offset
      const endIndex = offset + limit
      const paginatedRows = allRows.slice(startIndex, endIndex)
      
      return {
        data: paginatedRows,
        pagination: {
          currentPage: page,
          pageSize: limit,
          totalItems: allRows.length,
          totalPages: Math.ceil(allRows.length / limit),
        },
      }
    } catch (error) {
      console.error("Erreur lors de la récupération combinée:", error)
      throw new AppError("Erreur lors de la récupération des produits combinés", 500)
    }
  }

  // Récupérer un produit par ID (cherche dans toutes les tables)
  static async getReboulProductById(id) {
    try {
      // Chercher dans products d'abord
      let { rows } = await pool.query("SELECT *, store_type, 'products' as source_table FROM products WHERE id = $1 AND store_type = 'adult'", [id])
      
      if (rows.length === 0) {
        // Chercher dans sneakers_products
        const { rows: sneakersRows } = await pool.query("SELECT *, 'sneakers' as store_type, 'sneakers_products' as source_table FROM sneakers_products WHERE id = $1", [id])
        
        if (sneakersRows.length === 0) {
          // Chercher dans minots_products
          const { rows: minotsRows } = await pool.query("SELECT *, 'kids' as store_type, 'minots_products' as source_table FROM minots_products WHERE id = $1", [id])
          
          if (minotsRows.length === 0) {
            throw new AppError("Produit non trouvé", 404)
          }
          rows = minotsRows
        } else {
          rows = sneakersRows
        }
      }
      
      return rows[0]
    } catch (error) {
      console.error("Erreur lors de la récupération du produit:", error)
      throw new AppError("Erreur lors de la récupération du produit", 500)
    }
  }

  // Statistiques par store_type
  static async getReboulStats() {
    try {
      const query = `
        SELECT 
          'adult' as store_type,
          COUNT(*) as total,
          SUM(CASE WHEN new = true THEN 1 ELSE 0 END) as new_count
        FROM products WHERE store_type = 'adult' AND active = true
        
        UNION ALL
        
        SELECT 
          'sneakers' as store_type,
          COUNT(*) as total,
          SUM(CASE WHEN new = true THEN 1 ELSE 0 END) as new_count
        FROM sneakers_products WHERE active = true
        
        UNION ALL
        
        SELECT 
          'kids' as store_type,
          COUNT(*) as total,
          SUM(CASE WHEN new = true THEN 1 ELSE 0 END) as new_count
        FROM minots_products WHERE active = true
      `
      
      const { rows } = await pool.query(query)
      
      const stats = {}
      rows.forEach(row => {
        stats[row.store_type] = {
          total: parseInt(row.total),
          new: parseInt(row.new_count)
        }
      })
      
      return stats
    } catch (error) {
      console.error("Erreur lors du calcul des statistiques:", error)
      throw new AppError("Erreur lors du calcul des statistiques", 500)
    }
  }
}

module.exports = { ReboulProductController } 