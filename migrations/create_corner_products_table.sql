-- Migration: Création de la table corner_products pour The Corner
-- Cette table a une structure similaire à la table 'products'

-- Création de la table corner_products
CREATE TABLE IF NOT EXISTS corner_products (
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

-- Création des index pour améliorer les performances
CREATE INDEX idx_corner_products_category ON corner_products(category_id);
CREATE INDEX idx_corner_products_brand_id ON corner_products(brand_id);
CREATE INDEX idx_corner_products_store_reference ON corner_products(store_reference);

-- Mise à jour de la table order_items pour prendre en compte les produits de The Corner
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS is_corner_product BOOLEAN DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS corner_product_id INTEGER REFERENCES corner_products(id);

-- Mise à jour de la table reviews pour prendre en compte les produits de The Corner
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_corner_product BOOLEAN DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS corner_product_id INTEGER REFERENCES corner_products(id);

-- Mise à jour de la table favorites pour prendre en compte les produits de The Corner
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS is_corner_product BOOLEAN DEFAULT false;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS corner_product_id INTEGER REFERENCES corner_products(id);

-- Création des fonctions de trigger pour mettre à jour le champ updated_at
CREATE OR REPLACE FUNCTION update_corner_products_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_corner_products_timestamp
BEFORE UPDATE ON corner_products
FOR EACH ROW
EXECUTE FUNCTION update_corner_products_timestamp(); 