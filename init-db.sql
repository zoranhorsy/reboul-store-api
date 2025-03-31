-- Supprimer les tables si elles existent
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS stats_cache CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;

-- Créer la table users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer la table settings
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    site_name VARCHAR(255) NOT NULL,
    site_description TEXT,
    contact_email VARCHAR(255),
    enable_registration BOOLEAN DEFAULT true,
    enable_checkout BOOLEAN DEFAULT true,
    maintenance_mode BOOLEAN DEFAULT false,
    currency VARCHAR(10) DEFAULT 'EUR',
    tax_rate DECIMAL(5,2) DEFAULT 20.00,
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
    product_id INTEGER NOT NULL,
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

-- Insérer les paramètres par défaut
INSERT INTO settings (
    site_name, 
    site_description, 
    contact_email, 
    enable_registration, 
    enable_checkout, 
    maintenance_mode, 
    currency, 
    tax_rate
) VALUES (
    'Mon E-commerce',
    'Description du site',
    'contact@example.com',
    true,
    true,
    false,
    'EUR',
    20.00
);

-- Créer des index pour optimiser les performances
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_stats_cache_type_date ON stats_cache(stat_type, stat_date); 