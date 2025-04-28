-- Migration: Création de la table corner_product_variants
-- Cette table gère les variants des produits The Corner de manière similaire à product_variants

-- Création de la séquence pour l'ID
CREATE SEQUENCE IF NOT EXISTS corner_product_variants_id_seq;

-- Création de la table corner_product_variants
CREATE TABLE IF NOT EXISTS corner_product_variants (
    id INTEGER PRIMARY KEY DEFAULT nextval('corner_product_variants_id_seq'),
    corner_product_id INTEGER NOT NULL,
    taille CHARACTER VARYING(10),
    couleur CHARACTER VARYING(50),
    stock INTEGER DEFAULT 0,
    product_name TEXT,
    store_reference TEXT,
    category_id INTEGER,
    brand_id INTEGER,
    price NUMERIC(10,2),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (corner_product_id) REFERENCES corner_products(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (brand_id) REFERENCES brands(id)
);

-- Création des index pour améliorer les performances
CREATE INDEX idx_corner_product_variants_corner_product_id ON corner_product_variants(corner_product_id);
CREATE INDEX idx_corner_product_variants_category_id ON corner_product_variants(category_id);
CREATE INDEX idx_corner_product_variants_brand_id ON corner_product_variants(brand_id);
CREATE INDEX idx_corner_product_variants_store_reference ON corner_product_variants(store_reference);

-- Fonction pour mettre à jour le timestamp updated_at
CREATE OR REPLACE FUNCTION update_corner_product_variants_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour mettre à jour automatiquement updated_at
CREATE TRIGGER update_corner_product_variants_timestamp
    BEFORE UPDATE ON corner_product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_corner_product_variants_timestamp();

-- Commentaires sur la table et les colonnes
COMMENT ON TABLE corner_product_variants IS 'Table des variants des produits The Corner';
COMMENT ON COLUMN corner_product_variants.corner_product_id IS 'ID du produit The Corner associé';
COMMENT ON COLUMN corner_product_variants.taille IS 'Taille du variant (XS, S, M, L, XL, etc.)';
COMMENT ON COLUMN corner_product_variants.couleur IS 'Couleur du variant';
COMMENT ON COLUMN corner_product_variants.stock IS 'Quantité en stock du variant';
COMMENT ON COLUMN corner_product_variants.product_name IS 'Nom du produit (pour référence rapide)';
COMMENT ON COLUMN corner_product_variants.store_reference IS 'Référence du magasin';
COMMENT ON COLUMN corner_product_variants.category_id IS 'ID de la catégorie';
COMMENT ON COLUMN corner_product_variants.brand_id IS 'ID de la marque';
COMMENT ON COLUMN corner_product_variants.price IS 'Prix spécifique au variant (si différent du produit)';
COMMENT ON COLUMN corner_product_variants.active IS 'Indique si le variant est actif';

-- Migration pour modifier la table corner_products
ALTER TABLE corner_products
    DROP COLUMN IF EXISTS variants,
    ADD COLUMN IF NOT EXISTS has_variants BOOLEAN DEFAULT false; 