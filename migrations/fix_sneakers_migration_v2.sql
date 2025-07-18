-- Script de correction V2 pour la migration des sneakers
-- Colonnes corrigées selon la structure réelle des tables

-- ====================================
-- ÉTAPE 1 : NETTOYAGE DES DONNÉES PARTIELLES
-- ====================================

-- Supprimer les données partielles de la migration précédente
DELETE FROM sneakers_variants;
DELETE FROM sneakers_products;
DELETE FROM migration_backup WHERE new_table IN ('sneakers_products', 'minots_products');

-- Réinitialiser les séquences
SELECT setval('sneakers_products_id_seq', 1, false);
SELECT setval('sneakers_variants_id_seq', 1, false);

-- ====================================
-- ÉTAPE 2 : MIGRATION CORRIGÉE DES SNEAKERS
-- ====================================

-- Compter les sneakers à migrer
DO $$
DECLARE 
    sneakers_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO sneakers_count FROM products WHERE store_type = 'sneakers';
    RAISE NOTICE 'Produits sneakers à migrer : %', sneakers_count;
END $$;

-- Migration des produits sneakers (colonnes existantes uniquement)
INSERT INTO sneakers_products (
    id, name, description, price, category_id, brand_id, brand, 
    image_url, images, variants, tags, details, featured, active, new, 
    sku, store_reference, material, weight, dimensions, rating, reviews_count, 
    created_at, _actiontype
)
SELECT 
    id, name, description, price, category_id, brand_id, brand, 
    image_url, images, variants, tags, details, featured, active, new, 
    sku, store_reference, material, weight, dimensions, rating, reviews_count, 
    created_at, _actiontype
FROM products 
WHERE store_type = 'sneakers'
ON CONFLICT (id) DO NOTHING;

-- Ajuster la séquence d'ID pour sneakers_products
SELECT setval('sneakers_products_id_seq', COALESCE((SELECT MAX(id) FROM sneakers_products), 1), true);

-- Migration des variants sneakers depuis product_variants (colonnes existantes uniquement)
INSERT INTO sneakers_variants (
    sneakers_product_id, taille, couleur, stock, product_name, store_reference, 
    category_id, brand_id, price, active
)
SELECT 
    pv.products_id, pv.taille, pv.couleur, pv.stock, pv.product_name, pv.store_reference, 
    pv.category_id, pv.brand_id, pv.price, pv.active
FROM product_variants pv
WHERE pv.products_id IN (SELECT id FROM products WHERE store_type = 'sneakers')
ON CONFLICT DO NOTHING;

-- Vérification des sneakers migrés
DO $$
DECLARE 
    original_count INTEGER;
    migrated_count INTEGER;
    variants_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO original_count FROM products WHERE store_type = 'sneakers';
    SELECT COUNT(*) INTO migrated_count FROM sneakers_products;
    SELECT COUNT(*) INTO variants_count FROM sneakers_variants;
    
    RAISE NOTICE 'Sneakers originaux : %', original_count;
    RAISE NOTICE 'Sneakers migrés : %', migrated_count;
    RAISE NOTICE 'Variants sneakers : %', variants_count;
    
    IF original_count != migrated_count THEN
        RAISE NOTICE 'Attention: Migration incomplète. Vérification des IDs manquants...';
        
        -- Afficher les IDs manquants
        RAISE NOTICE 'IDs manquants: %', (
            SELECT string_agg(id::text, ', ') 
            FROM products 
            WHERE store_type = 'sneakers' 
            AND id NOT IN (SELECT id FROM sneakers_products)
        );
    END IF;
END $$;

-- ====================================
-- ÉTAPE 3 : MIGRATION DES RÉFÉRENCES (SÉCURISÉE)
-- ====================================

-- Migrer les favoris sneakers (seulement si le produit a été migré)
UPDATE favorites 
SET is_sneakers_product = true, 
    sneakers_product_id = product_id
WHERE product_id IN (SELECT id FROM sneakers_products);

-- Migrer les reviews sneakers (seulement si le produit a été migré)
UPDATE reviews 
SET is_sneakers_product = true, 
    sneakers_product_id = product_id
WHERE product_id IN (SELECT id FROM sneakers_products);

-- Migrer les order_items sneakers (seulement si le produit a été migré)
UPDATE order_items 
SET is_sneakers_product = true, 
    sneakers_product_id = product_id
WHERE product_id IN (SELECT id FROM sneakers_products);

-- ====================================
-- ÉTAPE 4 : VÉRIFICATION ET SAUVEGARDE
-- ====================================

-- Vérifier les références mises à jour
DO $$
DECLARE 
    favorites_count INTEGER;
    reviews_count INTEGER;
    orders_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO favorites_count FROM favorites WHERE is_sneakers_product = true;
    SELECT COUNT(*) INTO reviews_count FROM reviews WHERE is_sneakers_product = true;
    SELECT COUNT(*) INTO orders_count FROM order_items WHERE is_sneakers_product = true;
    
    RAISE NOTICE 'Favoris sneakers mis à jour : %', favorites_count;
    RAISE NOTICE 'Reviews sneakers mis à jour : %', reviews_count;
    RAISE NOTICE 'Commandes sneakers mis à jour : %', orders_count;
END $$;

-- Sauvegarder les IDs des produits migrés
INSERT INTO migration_backup (table_name, original_id, new_table)
SELECT 'products', id, 'sneakers_products' FROM sneakers_products;

-- Quelques exemples de produits migrés
DO $$
DECLARE 
    exemple_produits TEXT;
BEGIN
    SELECT string_agg(id || ': ' || name, ', ') INTO exemple_produits
    FROM sneakers_products 
    LIMIT 5;
    
    RAISE NOTICE 'Exemples de produits migrés : %', exemple_produits;
END $$;

-- Message de fin
DO $$
DECLARE 
    final_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO final_count FROM sneakers_products;
    RAISE NOTICE '✅ Migration terminée ! % produits sneakers migrés avec succès.', final_count;
END $$; 