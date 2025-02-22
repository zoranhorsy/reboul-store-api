-- Supprimer les tables si elles existent
DROP TABLE IF EXISTS stats_cache CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Créer la table users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table products
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    category_id INTEGER REFERENCES categories(id),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table orders
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table order_items
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table stats_cache
CREATE TABLE stats_cache (
    id SERIAL PRIMARY KEY,
    stat_type VARCHAR(50) NOT NULL,
    stat_date DATE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stat_type, stat_date)
);

-- Insérer des données de test

-- Utilisateurs
INSERT INTO users (username, email, password, is_admin) VALUES
    ('admin', 'admin@reboul.com', '$2b$10$vPf4.49QMKS0qTxLQsXkCOPEPuS/UAqmQBSHaxlg7fZDkXMAXN0bC', true),  -- mot de passe: admin123
    ('user1', 'user1@test.com', '$2b$10$vPf4.49QMKS0qTxLQsXkCOPEPuS/UAqmQBSHaxlg7fZDkXMAXN0bC', false),
    ('user2', 'user2@test.com', '$2b$10$vPf4.49QMKS0qTxLQsXkCOPEPuS/UAqmQBSHaxlg7fZDkXMAXN0bC', false);

-- Catégories
INSERT INTO categories (name, description) VALUES
    ('Sneakers', 'Chaussures de sport et lifestyle'),
    ('Running', 'Chaussures de course'),
    ('Basketball', 'Chaussures de basketball');

-- Produits
INSERT INTO products (name, description, price, stock, category_id) VALUES
    ('Nike Air Max', 'Sneakers confortables', 129.99, 50, 1),
    ('Adidas Superstar', 'Sneakers classiques', 99.99, 30, 1),
    ('Nike Zoom', 'Chaussures de running performantes', 159.99, 20, 2),
    ('Jordan 1', 'Sneakers iconiques', 179.99, 15, 3);

-- Commandes
INSERT INTO orders (user_id, total_amount, status) VALUES
    (2, 129.99, 'completed'),
    (2, 199.98, 'pending'),
    (3, 159.99, 'completed'),
    (3, 179.99, 'processing');

-- Éléments de commande
INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
    (1, 1, 1, 129.99),
    (2, 2, 2, 99.99),
    (3, 3, 1, 159.99),
    (4, 4, 1, 179.99);

-- Ajouter des index pour améliorer les performances
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_stats_cache_type_date ON stats_cache(stat_type, stat_date);

-- Mettre à jour les séquences
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders));
SELECT setval('order_items_id_seq', (SELECT MAX(id) FROM order_items)); 