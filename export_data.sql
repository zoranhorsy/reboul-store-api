-- Désactiver les contraintes de clés étrangères
SET session_replication_role = 'replica';

-- Export des données
\copy (SELECT id, username, email, password_hash, first_name, last_name, is_admin, created_at, notification_settings FROM users) TO '/tmp/users.csv' WITH CSV HEADER;
\copy (SELECT id, name, description, created_at, updated_at FROM categories) TO '/tmp/categories.csv' WITH CSV HEADER;
\copy (SELECT id, name, description, price, old_price, stock, category_id, brand, image_url, images, variants, tags, details, store_type, featured, created_at FROM products) TO '/tmp/products.csv' WITH CSV HEADER;
\copy (SELECT id, user_id, total_amount, status, shipping_address, created_at, updated_at FROM orders) TO '/tmp/orders.csv' WITH CSV HEADER;
\copy (SELECT id, order_id, product_id, product_name, quantity, price, variant, created_at, updated_at FROM order_items) TO '/tmp/order_items.csv' WITH CSV HEADER;
\copy (SELECT id, user_id, street, city, postal_code, country, created_at, updated_at FROM addresses) TO '/tmp/addresses.csv' WITH CSV HEADER;
\copy (SELECT id, user_id, product_id, rating, comment, created_at, updated_at FROM reviews) TO '/tmp/reviews.csv' WITH CSV HEADER;
\copy (SELECT id, user_id, product_id, created_at FROM favorites) TO '/tmp/favorites.csv' WITH CSV HEADER;

-- Réactiver les contraintes de clés étrangères
SET session_replication_role = 'origin'; 