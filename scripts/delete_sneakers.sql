-- Suppression de TOUS les produits sneakers
-- Usage: railway run psql -f backend/scripts/delete_sneakers.sql

\echo '🗑️  Suppression de TOUS les sneakers...'

-- 1. Supprimer les références dans order_items
DELETE FROM order_items 
WHERE product_id IN (SELECT id FROM sneakers_products);

-- 2. Supprimer les variants des sneakers
DELETE FROM sneakers_variants 
WHERE product_id IN (SELECT id FROM sneakers_products);

-- 3. Supprimer tous les produits sneakers
DELETE FROM sneakers_products;

-- 4. Vérifier le résultat
SELECT 'sneakers_products' as table_name, COUNT(*) as remaining_products FROM sneakers_products;

\echo '✅ Tous les sneakers supprimés !' 