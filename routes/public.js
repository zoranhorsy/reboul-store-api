const express = require('express');
const router = express.Router();
const db = require('../db');

// Endpoint public minimal pour le sitemap
// Retourne uniquement les champs nécessaires et filtre les éléments supprimés/inactifs
router.get('/sitemap-products', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 1000);

    const sql = `
      (
        SELECT id::text AS id,
               created_at,
               updated_at,
               COALESCE(active, true) AS active,
               COALESCE(deleted, false) AS deleted,
               'adult'::text AS store_type
        FROM products
        WHERE COALESCE(active, true) = true
          AND COALESCE(deleted, false) = false
      )
      UNION ALL
      (
        SELECT id::text AS id,
               created_at,
               updated_at,
               COALESCE(active, true) AS active,
               COALESCE(deleted, false) AS deleted,
               'sneakers'::text AS store_type
        FROM sneakers_products
        WHERE COALESCE(active, true) = true
          AND COALESCE(deleted, false) = false
      )
      UNION ALL
      (
        SELECT id::text AS id,
               created_at,
               updated_at,
               COALESCE(active, true) AS active,
               COALESCE(deleted, false) AS deleted,
               'kids'::text AS store_type
        FROM minots_products
        WHERE COALESCE(active, true) = true
          AND COALESCE(deleted, false) = false
      )
      UNION ALL
      (
        SELECT id::text AS id,
               created_at,
               updated_at,
               COALESCE(active, true) AS active,
               COALESCE(deleted, false) AS deleted,
               'cpcompany'::text AS store_type
        FROM corner_products
        WHERE COALESCE(active, true) = true
          AND COALESCE(deleted, false) = false
      )
      ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
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


