-- Mettre à jour les URLs des images des produits
UPDATE products 
SET image_url = CASE brand
    WHEN 'C.P.COMPANY' THEN '/brands/CP%20COMPANY/cp_2_b.png'
    WHEN 'STONE ISLAND' THEN '/brands/STONE%20ISLAND/stone_island_2_b.png'
    WHEN 'SALOMON' THEN '/brands/SALOMON/salomon_2_b.png'
    WHEN 'PALM ANGELS' THEN '/brands/PALM%20ANGELS/palmangels_b.png'
    WHEN 'OFF-WHITE' THEN '/brands/OFF-WHITE/off_white_b.png'
    ELSE '/placeholder.png'
END;

-- Insérer des produits de test
INSERT INTO products (name, description, price, stock, category_id, brand, image_url, variants, store_type, featured)
VALUES 
('C.P. Company Sweatshirt', 'Sweatshirt avec lentille sur la manche', 299.99, 10, 2, 'C.P.COMPANY', 
 '/brands/CP%20COMPANY/cp_2_b.png',
 '[{"size": "M", "color": "Noir", "stock": 5}, {"size": "L", "color": "Noir", "stock": 5}]'::jsonb,
 'cpcompany', true),

('Stone Island Jacket', 'Veste technique avec badge amovible', 599.99, 8, 6, 'STONE ISLAND',
 '/brands/STONE%20ISLAND/stone_island_2_b.png',
 '[{"size": "M", "color": "Bleu Marine", "stock": 4}, {"size": "L", "color": "Bleu Marine", "stock": 4}]'::jsonb,
 'adult', true),

('Salomon XT-6', 'Sneakers techniques et confortables', 189.99, 15, 20, 'SALOMON',
 '/brands/SALOMON/salomon_2_b.png',
 '[{"size": "41", "color": "Noir", "stock": 5}, {"size": "42", "color": "Noir", "stock": 5}, {"size": "43", "color": "Noir", "stock": 5}]'::jsonb,
 'sneakers', true),

('Palm Angels Track Jacket', 'Veste de survêtement avec bandes latérales', 450.00, 6, 6, 'PALM ANGELS',
 '/brands/PALM%20ANGELS/palmangels_b.png',
 '[{"size": "S", "color": "Noir", "stock": 2}, {"size": "M", "color": "Noir", "stock": 2}, {"size": "L", "color": "Noir", "stock": 2}]'::jsonb,
 'adult', true),

('Off-White T-Shirt', 'T-shirt avec impression graphique', 290.00, 12, 2, 'OFF-WHITE',
 '/brands/OFF-WHITE/off_white_b.png',
 '[{"size": "S", "color": "Blanc", "stock": 4}, {"size": "M", "color": "Blanc", "stock": 4}, {"size": "L", "color": "Blanc", "stock": 4}]'::jsonb,
 'adult', true);

-- Mettre à jour la séquence
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products)); 