-- Scripts de suppression manuelle pour changement de collection
-- À utiliser quand tu veux vider une table pour une nouvelle collection

-- =====================================================
-- 1. SUPPRIMER TOUS LES PRODUITS SNEAKERS
-- =====================================================

-- Supprimer d'abord les références dans order_items
DELETE FROM order_items 
WHERE product_id IN (SELECT id FROM sneakers_products);

-- Supprimer les variants des sneakers
DELETE FROM sneakers_variants 
WHERE product_id IN (SELECT id FROM sneakers_products);

-- Supprimer tous les produits sneakers
DELETE FROM sneakers_products;

-- Reset de l'auto-increment (optionnel)
-- ALTER SEQUENCE sneakers_products_id_seq RESTART WITH 1;


-- =====================================================
-- 2. SUPPRIMER TOUS LES PRODUITS MINOTS/KIDS
-- =====================================================

-- Supprimer d'abord les références dans order_items
DELETE FROM order_items 
WHERE product_id IN (SELECT id FROM minots_products);

-- Supprimer les variants des minots
DELETE FROM minots_variants 
WHERE product_id IN (SELECT id FROM minots_products);

-- Supprimer tous les produits minots
DELETE FROM minots_products;

-- Reset de l'auto-increment (optionnel)
-- ALTER SEQUENCE minots_products_id_seq RESTART WITH 1;


-- =====================================================
-- 3. SUPPRIMER TOUS LES PRODUITS ADULTES
-- =====================================================

-- Supprimer d'abord les références dans order_items
DELETE FROM order_items 
WHERE product_id IN (SELECT id FROM products WHERE store_type = 'adult');

-- Supprimer tous les produits adultes
DELETE FROM products WHERE store_type = 'adult';


-- =====================================================
-- 4. SUPPRIMER QUELQUES PRODUITS SPÉCIFIQUES
-- =====================================================

-- Exemple : supprimer des sneakers par ID
-- DELETE FROM order_items WHERE product_id IN (1, 2, 3);
-- DELETE FROM sneakers_variants WHERE product_id IN (1, 2, 3);
-- DELETE FROM sneakers_products WHERE id IN (1, 2, 3);


-- =====================================================
-- 5. VÉRIFIER CE QUI RESTE
-- =====================================================

SELECT 'sneakers_products' as table_name, COUNT(*) as count FROM sneakers_products
UNION ALL
SELECT 'minots_products' as table_name, COUNT(*) as count FROM minots_products  
UNION ALL
SELECT 'products (adult)' as table_name, COUNT(*) as count FROM products WHERE store_type = 'adult'; 