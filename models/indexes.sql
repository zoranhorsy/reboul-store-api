-- Indexes pour optimiser les requêtes paginées
-- Ces index améliorent les performances des requêtes avec filtrage et tri

-- Index sur la table products pour les filtres de catalogue les plus utilisés
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_store_type ON products (store_type);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products (brand_id);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products (featured);
CREATE INDEX IF NOT EXISTS idx_products_actiontype ON products (_actiontype);
CREATE INDEX IF NOT EXISTS idx_products_price ON products ((price::numeric));
CREATE INDEX IF NOT EXISTS idx_products_name ON products (name varchar_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_products_new ON products (new);

-- Index composé pour les recherches de produits avec filtres multiples
CREATE INDEX IF NOT EXISTS idx_products_catalog_filter ON products (category_id, store_type, _actiontype, active);

-- Index pour les recherches de texte
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin (to_tsvector('french', name || ' ' || COALESCE(description, '')));

-- Index sur la table corner_products
CREATE INDEX IF NOT EXISTS idx_corner_products_category_id ON corner_products (category_id);
CREATE INDEX IF NOT EXISTS idx_corner_products_brand_id ON corner_products (brand_id);
CREATE INDEX IF NOT EXISTS idx_corner_products_featured ON corner_products (featured);
CREATE INDEX IF NOT EXISTS idx_corner_products_price ON corner_products ((price::numeric));
CREATE INDEX IF NOT EXISTS idx_corner_products_name ON corner_products (name varchar_pattern_ops);

-- Index optimisés pour les commandes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);

-- Index pour la table order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);

-- Commentaires explicatifs des index
COMMENT ON INDEX idx_products_category_id IS 'Optimise les filtres par catégorie';
COMMENT ON INDEX idx_products_store_type IS 'Optimise les filtres par type de magasin';
COMMENT ON INDEX idx_products_brand_id IS 'Optimise les filtres par marque';
COMMENT ON INDEX idx_products_featured IS 'Optimise les filtres pour les produits mis en avant';
COMMENT ON INDEX idx_products_search IS 'Optimise les recherches textuelles sur les produits';
COMMENT ON INDEX idx_products_catalog_filter IS 'Index composé pour les filtres de catalogue courants';
COMMENT ON INDEX idx_orders_created_at IS 'Optimise les requêtes par date de commande'; 