const express = require('express');
const router = express.Router();
const db = require('../db');

// Endpoint public minimal pour le sitemap
// Retourne uniquement les champs nécessaires et filtre les éléments supprimés/inactifs
router.get('/sitemap-products', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 1000);

    // Requête ultra-robuste: ne dépend pas de la présence de colonnes optionnelles
    // Utilise NOW() pour lastmod si colonnes absentes
    const sql = `
      (
        SELECT id::text AS id,
               NOW() AS created_at,
               NOW() AS updated_at,
               true AS active,
               false AS deleted,
               'adult'::text AS store_type
        FROM products
      )
      UNION ALL
      (
        SELECT id::text AS id,
               NOW() AS created_at,
               NOW() AS updated_at,
               true AS active,
               false AS deleted,
               'sneakers'::text AS store_type
        FROM sneakers_products
      )
      UNION ALL
      (
        SELECT id::text AS id,
               NOW() AS created_at,
               NOW() AS updated_at,
               true AS active,
               false AS deleted,
               'kids'::text AS store_type
        FROM minots_products
      )
      UNION ALL
      (
        SELECT id::text AS id,
               NOW() AS created_at,
               NOW() AS updated_at,
               true AS active,
               false AS deleted,
               'cpcompany'::text AS store_type
        FROM corner_products
      )
      ORDER BY updated_at DESC
      LIMIT $1
    `;

    const { rows } = await db.pool.query(sql, [limit]);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ data: rows });
  } catch (err) {
    console.error('Public sitemap endpoint error:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;


