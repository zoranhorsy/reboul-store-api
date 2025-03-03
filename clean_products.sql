-- Nettoyer la table products
TRUNCATE products CASCADE;

-- Insérer 8 produits SALOMON
INSERT INTO products (name, description, price, stock, image_url, images, variants, store_type, featured, brand_id)
SELECT 
    'SALOMON XT-' || i::text,
    'Sneakers SALOMON XT Series',
    200.00,
    10,
    '/uploads/1738939722021-L47460500_1_800x.png',
    ARRAY['/uploads/1738939722021-L47460500_1_800x.png'],
    jsonb_build_array(
        jsonb_build_object(
            'size', '40',
            'color', 'Noir',
            'stock', 5
        ),
        jsonb_build_object(
            'size', '41',
            'color', 'Noir',
            'stock', 5
        )
    ),
    'sneakers',
    true,
    (SELECT id FROM brands WHERE name = 'SALOMON')
FROM generate_series(1, 8) i;

-- Vérifier le résultat
SELECT p.id, p.name, p.image_url, b.name as brand_name, p.variants
FROM products p 
JOIN brands b ON p.brand_id = b.id 
ORDER BY p.id; 