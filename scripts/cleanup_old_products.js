const pool = require('../db');

/**
 * Script de nettoyage des anciens produits Reboul
 * À exécuter 2-3 fois par an lors des changements de collection
 */

async function cleanupOldProducts() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Début du nettoyage des anciens produits...');
    
    // 1. Identifier les produits qui peuvent être supprimés
    const productsToDelete = await client.query(`
      SELECT p.id, p.name, p.store_type, p.season
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      WHERE p.active = false 
        AND p.stock_status = 'archived'
        AND oi.product_id IS NULL  -- Pas de commandes associées
        AND (p.last_stock_update < NOW() - INTERVAL '12 months' OR p.last_stock_update IS NULL)
    `);
    
    const sneakersToDelete = await client.query(`
      SELECT sp.id, sp.name, sp.season
      FROM sneakers_products sp
      LEFT JOIN order_items oi ON sp.id = oi.product_id
      WHERE sp.active = false 
        AND sp.stock_status = 'archived'
        AND oi.product_id IS NULL  -- Pas de commandes associées
        AND (sp.last_stock_update < NOW() - INTERVAL '12 months' OR sp.last_stock_update IS NULL)
    `);
    
    console.log(`📊 Produits éligibles à la suppression:`);
    console.log(`- Products: ${productsToDelete.rows.length}`);
    console.log(`- Sneakers: ${sneakersToDelete.rows.length}`);
    
    // 2. Supprimer les produits sans références
    if (productsToDelete.rows.length > 0) {
      const productIds = productsToDelete.rows.map(p => p.id);
      await client.query(`DELETE FROM products WHERE id = ANY($1)`, [productIds]);
      console.log(`✅ ${productIds.length} produits supprimés de la table products`);
    }
    
    if (sneakersToDelete.rows.length > 0) {
      const sneakerIds = sneakersToDelete.rows.map(s => s.id);
      await client.query(`DELETE FROM sneakers_products WHERE id = ANY($1)`, [sneakerIds]);
      console.log(`✅ ${sneakerIds.length} sneakers supprimés de la table sneakers_products`);
    }
    
    // 3. Archiver les produits hors saison
    const archived = await client.query(`
      UPDATE sneakers_products 
      SET stock_status = 'archived', last_stock_update = NOW()
      WHERE stock_status = 'seasonal' 
        AND last_stock_update < NOW() - INTERVAL '6 months'
      RETURNING id, name
    `);
    
    console.log(`📦 ${archived.rows.length} produits archivés automatiquement`);
    
    // 4. Statistiques finales
    const stats = await client.query(`
      SELECT 
        'products' as table_name,
        COUNT(*) as total,
        COUNT(CASE WHEN active = true THEN 1 END) as active,
        COUNT(CASE WHEN stock_status = 'in_stock' THEN 1 END) as in_stock
      FROM products
      WHERE store_type = 'adult'
      
      UNION ALL
      
      SELECT 
        'sneakers_products' as table_name,
        COUNT(*) as total,
        COUNT(CASE WHEN active = true THEN 1 END) as active,
        COUNT(CASE WHEN stock_status = 'in_stock' THEN 1 END) as in_stock
      FROM sneakers_products
      
      UNION ALL
      
      SELECT 
        'minots_products' as table_name,
        COUNT(*) as total,
        COUNT(CASE WHEN active = true THEN 1 END) as active,
        COUNT(CASE WHEN stock_status = 'in_stock' THEN 1 END) as in_stock
      FROM minots_products
    `);
    
    console.log('\n📊 Statistiques après nettoyage:');
    console.table(stats.rows);
    
    console.log('✅ Nettoyage terminé avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Exécuter le script si appelé directement
if (require.main === module) {
  cleanupOldProducts()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOldProducts }; 