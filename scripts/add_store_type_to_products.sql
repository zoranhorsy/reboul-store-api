-- Script pour ajouter le champ store_type à la table products
-- Usage: railway run psql -f backend/scripts/add_store_type_to_products.sql

\echo '🔧 Ajout du champ store_type à la table products...'

-- 1. Ajouter la colonne store_type si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='store_type') THEN
        ALTER TABLE products ADD COLUMN store_type VARCHAR(50);
        \echo '✅ Colonne store_type ajoutée'
    ELSE
        \echo 'ℹ️  Colonne store_type existe déjà'
    END IF;
END $$;

-- 2. Ajouter la contrainte de validation pour store_type
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'products' AND constraint_name = 'products_store_type_check'
    ) THEN
        ALTER TABLE products 
        ADD CONSTRAINT products_store_type_check 
        CHECK (store_type IN ('adult', 'kids', 'sneakers', 'cpcompany'));
        \echo '✅ Contrainte de validation ajoutée'
    ELSE
        \echo 'ℹ️  Contrainte de validation existe déjà'
    END IF;
END $$;

-- 3. Mettre à jour tous les produits existants pour avoir store_type = 'adult'
UPDATE products 
SET store_type = 'adult' 
WHERE store_type IS NULL;

\echo '✅ Tous les produits existants mis à jour avec store_type = adult'

-- 4. Vérifier le résultat
SELECT 
    'products' as table_name,
    COUNT(*) as total_products,
    COUNT(CASE WHEN store_type = 'adult' THEN 1 END) as adult_products,
    COUNT(CASE WHEN active = true THEN 1 END) as active_products,
    COUNT(CASE WHEN active = true AND store_type = 'adult' THEN 1 END) as active_adult_products
FROM products;

\echo '✅ Script terminé avec succès !'
