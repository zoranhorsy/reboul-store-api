-- Migration des données : Transfer des sneakers et minots vers leurs nouvelles tables
-- PHASE 2 : Migration des données depuis la table products

-- ====================================
-- ÉTAPE 1 : MIGRATION DES SNEAKERS
-- ====================================

-- Comptage initial des sneakers
DO $$
DECLARE 
    sneakers_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO sneakers_count FROM products WHERE store_type = 'sneakers' AND active = true;
    RAISE NOTICE 'Produits sneakers à migrer : %', sneakers_count;
END $$;

-- Migration des produits sneakers
INSERT INTO sneakers_products (
    id, name, description, price, old_price, category_id, brand_id, brand, 
    image_url, images, variants, tags, details, featured, active, new, 
    sku, store_reference, material, weight, dimensions, rating, reviews_count, 
    created_at, updated_at, _actiontype
)
SELECT 
    id, name, description, price, old_price, category_id, brand_id, brand, 
    image_url, images, variants, tags, details, featured, active, new, 
    sku, store_reference, material, weight, dimensions, rating, reviews_count, 
    created_at, updated_at, _actiontype
FROM products 
WHERE store_type = 'sneakers' AND active = true;

-- Récupérer la séquence d'ID pour sneakers_products
SELECT setval('sneakers_products_id_seq', (SELECT MAX(id) FROM sneakers_products));

-- Migration des variants sneakers depuis product_variants
INSERT INTO sneakers_variants (
    sneakers_product_id, taille, couleur, stock, product_name, store_reference, 
    category_id, brand_id, price, active, created_at, updated_at
)
SELECT 
    pv.products_id, pv.taille, pv.couleur, pv.stock, pv.product_name, pv.store_reference, 
    pv.category_id, pv.brand_id, pv.price, pv.active, pv.created_at, pv.updated_at
FROM product_variants pv
JOIN products p ON pv.products_id = p.id
WHERE p.store_type = 'sneakers' AND p.active = true;

-- Vérification des sneakers migrés
DO $$
DECLARE 
    sneakers_migrated INTEGER;
    sneakers_variants_migrated INTEGER;
BEGIN
    SELECT COUNT(*) INTO sneakers_migrated FROM sneakers_products;
    SELECT COUNT(*) INTO sneakers_variants_migrated FROM sneakers_variants;
    RAISE NOTICE 'Sneakers migrés : %', sneakers_migrated;
    RAISE NOTICE 'Variants sneakers migrés : %', sneakers_variants_migrated;
END $$;

-- ====================================
-- ÉTAPE 2 : MIGRATION DES MINOTS
-- ====================================

-- Comptage initial des minots
DO $$
DECLARE 
    minots_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO minots_count FROM products WHERE store_type = 'kids' AND active = true;
    RAISE NOTICE 'Produits minots à migrer : %', minots_count;
END $$;

-- Migration des produits minots (si ils existent)
INSERT INTO minots_products (
    id, name, description, price, old_price, category_id, brand_id, brand, 
    image_url, images, variants, tags, details, featured, active, new, 
    sku, store_reference, material, weight, dimensions, rating, reviews_count, 
    created_at, updated_at, _actiontype
)
SELECT 
    id, name, description, price, old_price, category_id, brand_id, brand, 
    image_url, images, variants, tags, details, featured, active, new, 
    sku, store_reference, material, weight, dimensions, rating, reviews_count, 
    created_at, updated_at, _actiontype
FROM products 
WHERE store_type = 'kids' AND active = true;

-- Récupérer la séquence d'ID pour minots_products (si il y a des données)
DO $$
DECLARE 
    max_id INTEGER;
BEGIN
    SELECT MAX(id) INTO max_id FROM minots_products;
    IF max_id IS NOT NULL THEN
        PERFORM setval('minots_products_id_seq', max_id);
    END IF;
END $$;

-- Migration des variants minots depuis product_variants
INSERT INTO minots_variants (
    minots_product_id, taille, couleur, stock, product_name, store_reference, 
    category_id, brand_id, price, active, created_at, updated_at
)
SELECT 
    pv.products_id, pv.taille, pv.couleur, pv.stock, pv.product_name, pv.store_reference, 
    pv.category_id, pv.brand_id, pv.price, pv.active, pv.created_at, pv.updated_at
FROM product_variants pv
JOIN products p ON pv.products_id = p.id
WHERE p.store_type = 'kids' AND p.active = true;

-- Vérification des minots migrés
DO $$
DECLARE 
    minots_migrated INTEGER;
    minots_variants_migrated INTEGER;
BEGIN
    SELECT COUNT(*) INTO minots_migrated FROM minots_products;
    SELECT COUNT(*) INTO minots_variants_migrated FROM minots_variants;
    RAISE NOTICE 'Minots migrés : %', minots_migrated;
    RAISE NOTICE 'Variants minots migrés : %', minots_variants_migrated;
END $$;

-- ====================================
-- ÉTAPE 3 : MIGRATION DES RÉFÉRENCES
-- ====================================

-- Migrer les favoris sneakers
UPDATE favorites 
SET is_sneakers_product = true, 
    sneakers_product_id = product_id
WHERE product_id IN (
    SELECT id FROM products WHERE store_type = 'sneakers' AND active = true
);

-- Migrer les favoris minots
UPDATE favorites 
SET is_minots_product = true, 
    minots_product_id = product_id
WHERE product_id IN (
    SELECT id FROM products WHERE store_type = 'kids' AND active = true
);

-- Migrer les reviews sneakers
UPDATE reviews 
SET is_sneakers_product = true, 
    sneakers_product_id = product_id
WHERE product_id IN (
    SELECT id FROM products WHERE store_type = 'sneakers' AND active = true
);

-- Migrer les reviews minots
UPDATE reviews 
SET is_minots_product = true, 
    minots_product_id = product_id
WHERE product_id IN (
    SELECT id FROM products WHERE store_type = 'kids' AND active = true
);

-- Migrer les order_items sneakers
UPDATE order_items 
SET is_sneakers_product = true, 
    sneakers_product_id = product_id
WHERE product_id IN (
    SELECT id FROM products WHERE store_type = 'sneakers' AND active = true
);

-- Migrer les order_items minots
UPDATE order_items 
SET is_minots_product = true, 
    minots_product_id = product_id
WHERE product_id IN (
    SELECT id FROM products WHERE store_type = 'kids' AND active = true
);

-- ====================================
-- ÉTAPE 4 : VÉRIFICATION FINALE
-- ====================================

-- Vérifier les données migrées
DO $$
DECLARE 
    original_sneakers INTEGER;
    original_minots INTEGER;
    migrated_sneakers INTEGER;
    migrated_minots INTEGER;
    favorites_sneakers INTEGER;
    favorites_minots INTEGER;
    reviews_sneakers INTEGER;
    reviews_minots INTEGER;
    orders_sneakers INTEGER;
    orders_minots INTEGER;
BEGIN
    -- Comptage des données originales
    SELECT COUNT(*) INTO original_sneakers FROM products WHERE store_type = 'sneakers' AND active = true;
    SELECT COUNT(*) INTO original_minots FROM products WHERE store_type = 'kids' AND active = true;
    
    -- Comptage des données migrées
    SELECT COUNT(*) INTO migrated_sneakers FROM sneakers_products;
    SELECT COUNT(*) INTO migrated_minots FROM minots_products;
    
    -- Comptage des références mises à jour
    SELECT COUNT(*) INTO favorites_sneakers FROM favorites WHERE is_sneakers_product = true;
    SELECT COUNT(*) INTO favorites_minots FROM favorites WHERE is_minots_product = true;
    SELECT COUNT(*) INTO reviews_sneakers FROM reviews WHERE is_sneakers_product = true;
    SELECT COUNT(*) INTO reviews_minots FROM reviews WHERE is_minots_product = true;
    SELECT COUNT(*) INTO orders_sneakers FROM order_items WHERE is_sneakers_product = true;
    SELECT COUNT(*) INTO orders_minots FROM order_items WHERE is_minots_product = true;
    
    -- Affichage des résultats
    RAISE NOTICE '=== RÉSULTATS DE LA MIGRATION ===';
    RAISE NOTICE 'Sneakers originaux : % | Sneakers migrés : %', original_sneakers, migrated_sneakers;
    RAISE NOTICE 'Minots originaux : % | Minots migrés : %', original_minots, migrated_minots;
    RAISE NOTICE 'Favoris sneakers : %', favorites_sneakers;
    RAISE NOTICE 'Favoris minots : %', favorites_minots;
    RAISE NOTICE 'Reviews sneakers : %', reviews_sneakers;
    RAISE NOTICE 'Reviews minots : %', reviews_minots;
    RAISE NOTICE 'Commandes sneakers : %', orders_sneakers;
    RAISE NOTICE 'Commandes minots : %', orders_minots;
    
    -- Vérifier l'intégrité
    IF original_sneakers != migrated_sneakers THEN
        RAISE EXCEPTION 'Erreur: Migration sneakers incomplète (% vs %)', original_sneakers, migrated_sneakers;
    END IF;
    
    IF original_minots != migrated_minots THEN
        RAISE EXCEPTION 'Erreur: Migration minots incomplète (% vs %)', original_minots, migrated_minots;
    END IF;
    
    RAISE NOTICE '✅ Migration terminée avec succès !';
END $$;

-- ====================================
-- SAUVEGARDE DES DONNÉES POUR ROLLBACK
-- ====================================

-- Créer une table de sauvegarde pour les IDs migrés
CREATE TABLE IF NOT EXISTS migration_backup (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50),
    original_id INTEGER,
    new_table VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sauvegarder les IDs des produits migrés
INSERT INTO migration_backup (table_name, original_id, new_table)
SELECT 'products', id, 'sneakers_products' FROM products WHERE store_type = 'sneakers' AND active = true;

INSERT INTO migration_backup (table_name, original_id, new_table)
SELECT 'products', id, 'minots_products' FROM products WHERE store_type = 'kids' AND active = true;

RAISE NOTICE 'Sauvegarde des IDs migrés terminée'; 