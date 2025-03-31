-- Check if the column exists, if not, add it
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='size_chart') THEN
        ALTER TABLE products ADD COLUMN size_chart JSONB;
    END IF;
    
    -- Vérifier si la colonne store_type existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='store_type') THEN
        ALTER TABLE products ADD COLUMN store_type VARCHAR(50);
    END IF;

    -- Ajouter la contrainte de validation pour store_type
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'products' AND constraint_name = 'products_store_type_check'
    ) THEN
        ALTER TABLE products 
        ADD CONSTRAINT products_store_type_check 
        CHECK (store_type IN ('adult', 'kids', 'sneakers', 'cpcompany'));
    END IF;

    -- Vérifier si la colonne image existe dans la table brands
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='brands' AND column_name='image') THEN
        ALTER TABLE brands ADD COLUMN image VARCHAR(255);
    END IF;

    -- Mettre à jour les images des marques existantes
    UPDATE brands 
    SET image = CASE 
        WHEN name = 'C.P COMPANY' THEN '/CP_2_b.png'
        WHEN name = 'STONE ISLAND' THEN '/STONE_ISLAND_2_b.png'
        WHEN name = 'AUTRY' THEN '/AUTRY_b.png'
        WHEN name = 'A.P.C' THEN '/APC_b.png'
        ELSE '/placeholder.png'
    END
    WHERE image IS NULL;

    -- Ajouter les colonnes logo_light et logo_dark à la table brands
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='brands' AND column_name='logo_light') THEN
        ALTER TABLE brands ADD COLUMN logo_light VARCHAR(255);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='brands' AND column_name='logo_dark') THEN
        ALTER TABLE brands ADD COLUMN logo_dark VARCHAR(255);
    END IF;

    -- Mettre à jour les logos des marques existantes
    UPDATE brands 
    SET 
        logo_light = CASE 
            WHEN name = 'C.P COMPANY' THEN '/brands/CP COMPANY/CP_2_w.png'
            WHEN name = 'STONE ISLAND' THEN '/brands/STONE ISLAND/STONE_ISLAND_2_w.png'
            WHEN name = 'AUTRY' THEN '/brands/AUTRY/AUTRY_w.png'
            WHEN name = 'A.P.C' THEN '/brands/A.P.C/APC_w.png'
            ELSE '/placeholder.png'
        END,
        logo_dark = CASE 
            WHEN name = 'C.P COMPANY' THEN '/brands/CP COMPANY/CP_2_b.png'
            WHEN name = 'STONE ISLAND' THEN '/brands/STONE ISLAND/STONE_ISLAND_2_b.png'
            WHEN name = 'AUTRY' THEN '/brands/AUTRY/AUTRY_b.png'
            WHEN name = 'A.P.C' THEN '/brands/A.P.C/APC_b.png'
            ELSE '/placeholder.png'
        END
    WHERE logo_light IS NULL OR logo_dark IS NULL;
END $$;

-- Mettre à jour les produits existants qui n'ont pas de store_type
UPDATE products 
SET store_type = 'adult' 
WHERE store_type IS NULL;

