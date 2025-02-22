-- Désactiver les contraintes de clé étrangère pendant l'export
SET session_replication_role = 'replica';

-- Export des utilisateurs
COPY (
    SELECT * FROM users
) TO '/tmp/users.csv' WITH CSV HEADER;

-- Export des catégories
COPY (
    SELECT * FROM categories
) TO '/tmp/categories.csv' WITH CSV HEADER;

-- Export des produits
COPY (
    SELECT * FROM products
) TO '/tmp/products.csv' WITH CSV HEADER;

-- Export des commandes
COPY (
    SELECT * FROM orders
) TO '/tmp/orders.csv' WITH CSV HEADER;

-- Export des éléments de commande
COPY (
    SELECT * FROM order_items
) TO '/tmp/order_items.csv' WITH CSV HEADER;

-- Export des adresses
COPY (
    SELECT * FROM addresses
) TO '/tmp/addresses.csv' WITH CSV HEADER;

-- Export des avis
COPY (
    SELECT * FROM reviews
) TO '/tmp/reviews.csv' WITH CSV HEADER;

-- Export des favoris
COPY (
    SELECT * FROM favorites
) TO '/tmp/favorites.csv' WITH CSV HEADER;

-- Réactiver les contraintes de clé étrangère
SET session_replication_role = 'origin'; 