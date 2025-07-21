-- Suppression de TOUS les produits Reboul
-- Usage: railway run psql -f backend/scripts/delete_all.sql

\echo '🚨 ATTENTION: Suppression de TOUS LES PRODUITS REBOUL !'

-- 1. Supprimer toutes les références dans order_items
DELETE FROM order_items 
WHERE product_id IN (SELECT id FROM sneakers_products);

DELETE FROM order_items 
WHERE product_id IN (SELECT id FROM minots_products);

DELETE FROM order_items 
WHERE product_id IN (SELECT id FROM products WHERE store_type = 'adult');

-- 2. Supprimer tous les variants
DELETE FROM sneakers_variants 
WHERE product_id IN (SELECT id FROM sneakers_products);

DELETE FROM minots_variants 
WHERE product_id IN (SELECT id FROM minots_products);

-- 3. Supprimer tous les produits
DELETE FROM sneakers_products;
DELETE FROM minots_products;
DELETE FROM products WHERE store_type = 'adult';

-- 4. Vérifier le résultat
SELECT 'RÉSUMÉ FINAL' as status;
SELECT 'sneakers_products' as table_name, COUNT(*) as remaining_products FROM sneakers_products
UNION ALL
SELECT 'minots_products' as table_name, COUNT(*) as remaining_products FROM minots_products
UNION ALL
SELECT 'products (adult)' as table_name, COUNT(*) as remaining_products FROM products WHERE store_type = 'adult';

\echo '�� TOUT supprimé !' 