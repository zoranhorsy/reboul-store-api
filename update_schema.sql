-- Mise à jour de la table brands
ALTER TABLE brands 
ADD COLUMN logo_dark text,
ADD COLUMN logo_light text;

-- Mise à jour de la table products
ALTER TABLE products 
ADD COLUMN brand_id integer REFERENCES brands(id);

-- Copier les données de la colonne brand vers brand_id
UPDATE products p 
SET brand_id = b.id 
FROM brands b 
WHERE UPPER(p.brand) = UPPER(b.name);

-- Vérification
SELECT COUNT(*) as products_with_brand_id 
FROM products 
WHERE brand_id IS NOT NULL; 