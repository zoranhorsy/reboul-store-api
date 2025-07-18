-- Migration: Création des tables sneakers_products et minots_products
-- Séparation des produits Reboul par type de magasin

-- ====================================
-- CRÉATION DE LA TABLE SNEAKERS_PRODUCTS
-- ====================================

CREATE TABLE IF NOT EXISTS sneakers_products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    old_price NUMERIC(10,2),
    category_id INTEGER REFERENCES categories(id),
    brand_id INTEGER REFERENCES brands(id),
    brand TEXT,
    image_url TEXT,
    images TEXT[],
    variants JSONB,
    tags TEXT[],
    details TEXT[],
    featured BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    new BOOLEAN DEFAULT false,
    sku CHARACTER VARYING(50),
    store_reference CHARACTER VARYING(100),
    material CHARACTER VARYING(100),
    weight INTEGER,
    dimensions CHARACTER VARYING(100),
    rating NUMERIC(3,2),
    reviews_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    _actiontype CHARACTER VARYING(50)
);

-- ====================================
-- CRÉATION DE LA TABLE MINOTS_PRODUCTS
-- ====================================

CREATE TABLE IF NOT EXISTS minots_products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    old_price NUMERIC(10,2),
    category_id INTEGER REFERENCES categories(id),
    brand_id INTEGER REFERENCES brands(id),
    brand TEXT,
    image_url TEXT,
    images TEXT[],
    variants JSONB,
    tags TEXT[],
    details TEXT[],
    featured BOOLEAN DEFAULT false,
    active BOOLEAN DEFAULT true,
    new BOOLEAN DEFAULT false,
    sku CHARACTER VARYING(50),
    store_reference CHARACTER VARYING(100),
    material CHARACTER VARYING(100),
    weight INTEGER,
    dimensions CHARACTER VARYING(100),
    rating NUMERIC(3,2),
    reviews_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    _actiontype CHARACTER VARYING(50)
);

-- ====================================
-- CRÉATION DE LA TABLE SNEAKERS_VARIANTS
-- ====================================

CREATE TABLE IF NOT EXISTS sneakers_variants (
    id SERIAL PRIMARY KEY,
    sneakers_product_id INTEGER NOT NULL REFERENCES sneakers_products(id) ON DELETE CASCADE,
    taille CHARACTER VARYING(10),
    couleur CHARACTER VARYING(50),
    stock INTEGER DEFAULT 0,
    product_name TEXT,
    store_reference TEXT,
    category_id INTEGER REFERENCES categories(id),
    brand_id INTEGER REFERENCES brands(id),
    price NUMERIC(10,2),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- CRÉATION DE LA TABLE MINOTS_VARIANTS
-- ====================================

CREATE TABLE IF NOT EXISTS minots_variants (
    id SERIAL PRIMARY KEY,
    minots_product_id INTEGER NOT NULL REFERENCES minots_products(id) ON DELETE CASCADE,
    taille CHARACTER VARYING(10),
    couleur CHARACTER VARYING(50),
    stock INTEGER DEFAULT 0,
    product_name TEXT,
    store_reference TEXT,
    category_id INTEGER REFERENCES categories(id),
    brand_id INTEGER REFERENCES brands(id),
    price NUMERIC(10,2),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- CRÉATION DES INDEX POUR LES PERFORMANCES
-- ====================================

-- Index pour sneakers_products
CREATE INDEX IF NOT EXISTS idx_sneakers_products_category_id ON sneakers_products(category_id);
CREATE INDEX IF NOT EXISTS idx_sneakers_products_brand_id ON sneakers_products(brand_id);
CREATE INDEX IF NOT EXISTS idx_sneakers_products_store_reference ON sneakers_products(store_reference);
CREATE INDEX IF NOT EXISTS idx_sneakers_products_featured ON sneakers_products(featured);
CREATE INDEX IF NOT EXISTS idx_sneakers_products_active ON sneakers_products(active);
CREATE INDEX IF NOT EXISTS idx_sneakers_products_new ON sneakers_products(new);
CREATE INDEX IF NOT EXISTS idx_sneakers_products_price ON sneakers_products(price);
CREATE INDEX IF NOT EXISTS idx_sneakers_products_name ON sneakers_products(name varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_sneakers_products_search ON sneakers_products USING gin (to_tsvector('french'::regconfig, (name || ' '::text) || COALESCE(description, ''::text)));

-- Index pour minots_products
CREATE INDEX IF NOT EXISTS idx_minots_products_category_id ON minots_products(category_id);
CREATE INDEX IF NOT EXISTS idx_minots_products_brand_id ON minots_products(brand_id);
CREATE INDEX IF NOT EXISTS idx_minots_products_store_reference ON minots_products(store_reference);
CREATE INDEX IF NOT EXISTS idx_minots_products_featured ON minots_products(featured);
CREATE INDEX IF NOT EXISTS idx_minots_products_active ON minots_products(active);
CREATE INDEX IF NOT EXISTS idx_minots_products_new ON minots_products(new);
CREATE INDEX IF NOT EXISTS idx_minots_products_price ON minots_products(price);
CREATE INDEX IF NOT EXISTS idx_minots_products_name ON minots_products(name varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_minots_products_search ON minots_products USING gin (to_tsvector('french'::regconfig, (name || ' '::text) || COALESCE(description, ''::text)));

-- Index pour sneakers_variants
CREATE INDEX IF NOT EXISTS idx_sneakers_variants_sneakers_product_id ON sneakers_variants(sneakers_product_id);
CREATE INDEX IF NOT EXISTS idx_sneakers_variants_category_id ON sneakers_variants(category_id);
CREATE INDEX IF NOT EXISTS idx_sneakers_variants_brand_id ON sneakers_variants(brand_id);
CREATE INDEX IF NOT EXISTS idx_sneakers_variants_store_reference ON sneakers_variants(store_reference);

-- Index pour minots_variants
CREATE INDEX IF NOT EXISTS idx_minots_variants_minots_product_id ON minots_variants(minots_product_id);
CREATE INDEX IF NOT EXISTS idx_minots_variants_category_id ON minots_variants(category_id);
CREATE INDEX IF NOT EXISTS idx_minots_variants_brand_id ON minots_variants(brand_id);
CREATE INDEX IF NOT EXISTS idx_minots_variants_store_reference ON minots_variants(store_reference);

-- ====================================
-- FONCTIONS DE MISE À JOUR DES TIMESTAMPS
-- ====================================

-- Fonction pour mettre à jour updated_at pour sneakers_products
CREATE OR REPLACE FUNCTION update_sneakers_products_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Fonction pour mettre à jour updated_at pour minots_products
CREATE OR REPLACE FUNCTION update_minots_products_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Fonction pour mettre à jour updated_at pour sneakers_variants
CREATE OR REPLACE FUNCTION update_sneakers_variants_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Fonction pour mettre à jour updated_at pour minots_variants
CREATE OR REPLACE FUNCTION update_minots_variants_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ====================================
-- CRÉATION DES TRIGGERS
-- ====================================

-- Triggers pour sneakers_products
CREATE OR REPLACE TRIGGER update_sneakers_products_timestamp
    BEFORE UPDATE ON sneakers_products
    FOR EACH ROW
    EXECUTE FUNCTION update_sneakers_products_timestamp();

-- Triggers pour minots_products
CREATE OR REPLACE TRIGGER update_minots_products_timestamp
    BEFORE UPDATE ON minots_products
    FOR EACH ROW
    EXECUTE FUNCTION update_minots_products_timestamp();

-- Triggers pour sneakers_variants
CREATE OR REPLACE TRIGGER update_sneakers_variants_timestamp
    BEFORE UPDATE ON sneakers_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_sneakers_variants_timestamp();

-- Triggers pour minots_variants
CREATE OR REPLACE TRIGGER update_minots_variants_timestamp
    BEFORE UPDATE ON minots_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_minots_variants_timestamp();

-- ====================================
-- COMMENTAIRES SUR LES TABLES
-- ====================================

COMMENT ON TABLE sneakers_products IS 'Table des produits sneakers Reboul (30% du CA)';
COMMENT ON TABLE minots_products IS 'Table des produits Les Minots de Reboul (enfants)';
COMMENT ON TABLE sneakers_variants IS 'Table des variants des produits sneakers';
COMMENT ON TABLE minots_variants IS 'Table des variants des produits minots';

-- ====================================
-- MISE À JOUR DES TABLES EXISTANTES
-- ====================================

-- Ajouter les nouvelles références dans order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_sneakers_product BOOLEAN DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sneakers_product_id INTEGER REFERENCES sneakers_products(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_minots_product BOOLEAN DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS minots_product_id INTEGER REFERENCES minots_products(id);

-- Ajouter les nouvelles références dans reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_sneakers_product BOOLEAN DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS sneakers_product_id INTEGER REFERENCES sneakers_products(id);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_minots_product BOOLEAN DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS minots_product_id INTEGER REFERENCES minots_products(id);

-- Ajouter les nouvelles références dans favorites
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS is_sneakers_product BOOLEAN DEFAULT false;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS sneakers_product_id INTEGER REFERENCES sneakers_products(id);
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS is_minots_product BOOLEAN DEFAULT false;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS minots_product_id INTEGER REFERENCES minots_products(id);

-- ====================================
-- VALIDATION DE LA MIGRATION
-- ====================================

-- Vérifier que toutes les tables ont été créées
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sneakers_products') THEN
        RAISE EXCEPTION 'Erreur: Table sneakers_products non créée';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'minots_products') THEN
        RAISE EXCEPTION 'Erreur: Table minots_products non créée';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sneakers_variants') THEN
        RAISE EXCEPTION 'Erreur: Table sneakers_variants non créée';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'minots_variants') THEN
        RAISE EXCEPTION 'Erreur: Table minots_variants non créée';
    END IF;
    
    RAISE NOTICE 'Migration terminée avec succès !';
    RAISE NOTICE 'Tables créées : sneakers_products, minots_products, sneakers_variants, minots_variants';
END $$; 