-- Suppression de TOUS les produits adultes
-- Usage: railway run psql -f backend/scripts/delete_adults.sql

\echo '🗑️  Suppression de TOUS les produits adultes...'

-- 1. Supprimer les références dans order_items
DELETE FROM order_items 
WHERE product_id IN (SELECT id FROM products WHERE store_type = 'adult');

-- 2. Supprimer tous les produits adultes
DELETE FROM products WHERE store_type = 'adult';

-- 3. Vérifier le résultat
SELECT 'products (adult)' as table_name, COUNT(*) as remaining_products FROM products WHERE store_type = 'adult';

\echo '✅ Tous les produits adultes supprimés !' 