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

-- Import des données
\copy users FROM '/tmp/users.csv' WITH CSV HEADER;
\copy categories FROM '/tmp/categories.csv' WITH CSV HEADER;
\copy products FROM '/tmp/products.csv' WITH CSV HEADER;
\copy orders FROM '/tmp/orders.csv' WITH CSV HEADER;
\copy order_items FROM '/tmp/order_items.csv' WITH CSV HEADER;
\copy addresses FROM '/tmp/addresses.csv' WITH CSV HEADER;
\copy reviews FROM '/tmp/reviews.csv' WITH CSV HEADER;
\copy favorites FROM '/tmp/favorites.csv' WITH CSV HEADER;

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