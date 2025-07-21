-- Stratégie de gestion de cycle de vie des produits Reboul
-- Adaptée aux changements de stock 2-3 fois par an

-- 1. Ajouter une colonne pour le statut de stock
ALTER TABLE sneakers_products ADD COLUMN IF NOT EXISTS stock_status VARCHAR(20) DEFAULT 'in_stock';
ALTER TABLE minots_products ADD COLUMN IF NOT EXISTS stock_status VARCHAR(20) DEFAULT 'in_stock';
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_status VARCHAR(20) DEFAULT 'in_stock';

-- 2. Ajouter une colonne pour la saison/collection
ALTER TABLE sneakers_products ADD COLUMN IF NOT EXISTS season VARCHAR(20);
ALTER TABLE minots_products ADD COLUMN IF NOT EXISTS season VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS season VARCHAR(20);

-- 3. Ajouter une colonne pour la date de dernière mise à jour stock
ALTER TABLE sneakers_products ADD COLUMN IF NOT EXISTS last_stock_update TIMESTAMP DEFAULT NOW();
ALTER TABLE minots_products ADD COLUMN IF NOT EXISTS last_stock_update TIMESTAMP DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS last_stock_update TIMESTAMP DEFAULT NOW();

-- Valeurs possibles pour stock_status :
-- 'in_stock'     : En stock, visible
-- 'out_of_stock' : Plus en stock, mais peut revenir
-- 'discontinued' : Arrêté définitivement
-- 'seasonal'     : Hors saison, reviendra
-- 'archived'     : Archivé (ancienne collection)

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_sneakers_stock_status ON sneakers_products(stock_status);
CREATE INDEX IF NOT EXISTS idx_minots_stock_status ON minots_products(stock_status);
CREATE INDEX IF NOT EXISTS idx_products_stock_status ON products(stock_status);

-- Exemple de mise à jour pour une nouvelle collection
-- UPDATE sneakers_products SET stock_status = 'archived', season = 'AW24' WHERE season = 'SS24';
-- UPDATE sneakers_products SET stock_status = 'in_stock', season = 'SS25' WHERE season IS NULL; 