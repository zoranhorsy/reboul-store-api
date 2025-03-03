-- Vider les tables existantes
TRUNCATE products CASCADE;
TRUNCATE brands CASCADE;

-- Créer une table temporaire pour les produits
CREATE TEMP TABLE temp_products (
    id INTEGER,
    name VARCHAR(255),
    description TEXT,
    price DECIMAL(10,2),
    stock INTEGER,
    category_id INTEGER,
    image_url TEXT,
    brand VARCHAR(255),
    images TEXT,
    variants JSONB,
    tags TEXT[],
    reviews JSONB,
    questions JSONB,
    faqs JSONB,
    size_chart JSONB,
    store_type VARCHAR(50),
    featured BOOLEAN,
    colors TEXT[]
);

-- Créer une table temporaire pour les marques
CREATE TEMP TABLE temp_brands (
    id INTEGER,
    name VARCHAR(255),
    logo_light TEXT,
    logo_dark TEXT,
    image TEXT
);

-- Copier les données dans les tables temporaires
\COPY temp_products FROM 'old_products.csv' WITH CSV HEADER;
\COPY temp_brands FROM 'old_brands.csv' WITH CSV HEADER;

-- Insérer les marques
INSERT INTO brands (id, name, logo_url, logo_dark)
SELECT 
    id,
    name,
    logo_light,
    logo_dark
FROM temp_brands;

-- Nettoyer et insérer les produits
INSERT INTO products (
    id, name, description, price, stock, 
    category_id, image_url, brand, images,
    variants, tags, store_type, featured
)
SELECT 
    p.id,
    p.name,
    p.description,
    p.price,
    p.stock,
    p.category_id,
    CASE
        WHEN p.image_url IS NULL OR p.image_url = '' THEN '/uploads/product-placeholder.jpg'
        WHEN p.image_url LIKE 'http://%' OR p.image_url LIKE 'https://%' THEN 
            '/uploads/' || split_part(p.image_url, '/', array_length(string_to_array(p.image_url, '/'), 1))
        WHEN p.image_url NOT LIKE '/uploads/%' THEN '/uploads/' || replace(p.image_url, '/', '')
        ELSE p.image_url
    END as image_url,
    p.brand,
    ARRAY[CASE
        WHEN p.image_url IS NULL OR p.image_url = '' THEN '/uploads/product-placeholder.jpg'
        WHEN p.image_url LIKE 'http://%' OR p.image_url LIKE 'https://%' THEN 
            '/uploads/' || split_part(p.image_url, '/', array_length(string_to_array(p.image_url, '/'), 1))
        WHEN p.image_url NOT LIKE '/uploads/%' THEN '/uploads/' || replace(p.image_url, '/', '')
        ELSE p.image_url
    END],
    p.variants::jsonb,
    p.tags,
    p.store_type,
    p.featured
FROM temp_products p
WHERE p.name IS NOT NULL;

-- Mettre à jour brand_id basé sur le nom de la marque
UPDATE products p 
SET brand_id = b.id 
FROM brands b 
WHERE UPPER(p.brand) = UPPER(b.name);

-- Vérifier l'import
SELECT COUNT(*) as total_products FROM products;
SELECT COUNT(*) as total_brands FROM brands;

-- Afficher quelques exemples
SELECT p.id, p.name, p.image_url, b.name as brand_name 
FROM products p 
LEFT JOIN brands b ON p.brand_id = b.id 
LIMIT 5;

-- Nettoyer
DROP TABLE temp_products;
DROP TABLE temp_brands; 