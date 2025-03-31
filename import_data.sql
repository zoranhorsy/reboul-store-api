-- Désactiver les contraintes de clé étrangère pendant l'import
SET session_replication_role = 'replica';

-- Nettoyer les tables existantes
TRUNCATE users, categories, products, orders, order_items, addresses, reviews, favorites CASCADE;

-- Réinitialiser les séquences
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE categories_id_seq RESTART WITH 1;
ALTER SEQUENCE products_id_seq RESTART WITH 1;
ALTER SEQUENCE orders_id_seq RESTART WITH 1;
ALTER SEQUENCE order_items_id_seq RESTART WITH 1;
ALTER SEQUENCE addresses_id_seq RESTART WITH 1;
ALTER SEQUENCE reviews_id_seq RESTART WITH 1;
ALTER SEQUENCE favorites_id_seq RESTART WITH 1;

-- Import des données avec les colonnes spécifiées
\copy users(id, username, email, password_hash, first_name, last_name, is_admin, created_at, notification_settings) FROM '/tmp/users.csv' WITH CSV HEADER;
\copy categories(id, name, description, created_at, updated_at) FROM '/tmp/categories.csv' WITH CSV HEADER;

-- Import direct des produits
INSERT INTO products (id, name, description, price, stock, category_id, image_url, brand, variants, store_type, featured)
VALUES
(32, 'Nouveau T-shirt', 'Un t-shirt confortable et élégant', 29.99, 96, 8, NULL, 'C.P.COMPANY', '[{"size": "M", "color": "rouge", "stock": 50}, {"size": "L", "color": "bleu", "stock": 50}, {"size": "S", "color": "Noir", "stock": 10}, {"size": "XS", "color": "Vert", "stock": 15}]'::jsonb, 'cpcompany', false),
(33, 'Nouveau T-shirt', 'Un t-shirt confortable et élégant', 29.99, 100, 2, 'http://localhost:5001/api/uploads/placeholder.png', NULL, '[{"size": "M", "color": "rouge", "stock": 50}, {"size": "L", "color": "bleu", "stock": 50}, {"size": "S", "color": "Noir", "stock": 50}]'::jsonb, 'adult', true),
(34, 'Nouveau T-shirt', 'Un t-shirt confortable et élégant', 29.99, 100, 2, 'http://localhost:5001/api/uploads/placeholder.png', NULL, '[{"size": "M", "color": "rouge", "stock": 50}, {"size": "L", "color": "bleu", "stock": 50}]'::jsonb, 'adult', true),
(35, 'SALOMON XT SLATE', 'Un t-shirt confortable et élégant', 200.00, 92, 12, 'http://localhost:5001/api/uploads/placeholder.png', NULL, '[{"size": "40", "color": "Noir", "stock": 10}]'::jsonb, 'sneakers', true),
(36, 'Nouveau T-shirt', 'Un t-shirt confortable et élégant', 29.99, 100, 2, '/placeholder.png', 'APC', '[{"size": "M", "color": "rouge", "stock": 50}, {"size": "L", "color": "bleu", "stock": 50}]'::jsonb, 'adult', false),
(41, 'Produit cp', 'ssss', 150.00, 0, 6, NULL, 'C.P.COMPANY', '[]'::jsonb, 'cpcompany', true),
(42, 'Produit', 'ssss', 300.00, 0, 2, NULL, 'C.P.COMPANY', '[{"size": "L", "color": "Noir", "stock": 2}]'::jsonb, 'cpcompany', true),
(44, 'Produit Test', 'Description test', 99.99, 5, 13, NULL, 'STONE ISLAND', '[{"size": "M", "color": "Noir", "stock": 3}, {"size": "L", "color": "Noir", "stock": 2}]'::jsonb, 'adult', false);

\copy orders(id, user_id, total_amount, status, shipping_address, created_at, updated_at) FROM '/tmp/orders.csv' WITH CSV HEADER;
\copy order_items(id, order_id, product_id, product_name, quantity, price, variant, created_at, updated_at) FROM '/tmp/order_items.csv' WITH CSV HEADER;
\copy addresses(id, user_id, street, city, postal_code, country, created_at, updated_at) FROM '/tmp/addresses.csv' WITH CSV HEADER;
\copy reviews(id, user_id, product_id, rating, comment, created_at, updated_at) FROM '/tmp/reviews.csv' WITH CSV HEADER;
\copy favorites(id, user_id, product_id, created_at) FROM '/tmp/favorites.csv' WITH CSV HEADER;

-- Mettre à jour les séquences
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders));
SELECT setval('order_items_id_seq', (SELECT MAX(id) FROM order_items));
SELECT setval('addresses_id_seq', (SELECT MAX(id) FROM addresses));
SELECT setval('reviews_id_seq', (SELECT MAX(id) FROM reviews));
SELECT setval('favorites_id_seq', (SELECT MAX(id) FROM favorites));

-- Réactiver les contraintes de clé étrangère
SET session_replication_role = 'origin'; 