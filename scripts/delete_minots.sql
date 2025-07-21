-- Suppression de TOUS les produits minots/kids
-- Usage: railway run psql -f backend/scripts/delete_minots.sql

\echo '🗑️  Suppression de TOUS les minots...'

-- 1. Supprimer les références dans order_items
DELETE FROM order_items 
WHERE product_id IN (SELECT id FROM minots_products);

-- 2. Supprimer les variants des minots
DELETE FROM minots_variants 
WHERE product_id IN (SELECT id FROM minots_products);

-- 3. Supprimer tous les produits minots
DELETE FROM minots_products;

-- 4. Vérifier le résultat
SELECT 'minots_products' as table_name, COUNT(*) as remaining_products FROM minots_products;

\echo '✅ Tous les minots supprimés !' 