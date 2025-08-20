-- Migration: Ajout de brand_id à la table collections_carousel
-- Date: 2025-01-27
-- Description: Ajouter une référence vers la table brands pour afficher le nombre d'articles

BEGIN;

-- Ajouter la colonne brand_id si elle n'existe pas déjà
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='collections_carousel' AND column_name='brand_id') THEN
        ALTER TABLE collections_carousel ADD COLUMN brand_id INTEGER REFERENCES brands(id);
    END IF;
END $$;

-- Créer un index pour améliorer les performances des jointures
CREATE INDEX IF NOT EXISTS idx_collections_carousel_brand_id ON collections_carousel(brand_id);

-- Mettre à jour les collections existantes avec les brand_id appropriés
UPDATE collections_carousel 
SET brand_id = (SELECT id FROM brands WHERE name ILIKE '%CP COMPANY%' LIMIT 1)
WHERE name ILIKE '%CP COMPANY%' AND brand_id IS NULL;

UPDATE collections_carousel 
SET brand_id = (SELECT id FROM brands WHERE name ILIKE '%AUTRY%' LIMIT 1)
WHERE name ILIKE '%AUTRY%' AND brand_id IS NULL;

COMMIT;

-- Commentaires pour la documentation
COMMENT ON COLUMN collections_carousel.brand_id IS 'Référence vers la marque associée à cette collection';
