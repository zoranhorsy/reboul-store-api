-- Migration pour créer la table collections_carousel
-- Cette table stocke les collections affichées dans le carousel de la page d'accueil

CREATE TABLE IF NOT EXISTS collections_carousel (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    link_url VARCHAR(500) NOT NULL,
    badge VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_collections_carousel_active ON collections_carousel(is_active);
CREATE INDEX idx_collections_carousel_sort ON collections_carousel(sort_order);

-- Données de test initiales
INSERT INTO collections_carousel (name, description, image_url, link_url, badge, sort_order) VALUES
('Collection CP Company', 'Design italien - Les essentiels CP Company', '/images/collections/cp-company.jpg', '/catalogue?brand=cp-company', 'Tendance', 1),
('Collection Sneakers', 'Les dernières nouveautés en sneakers', '/images/collections/sneakers-collection.jpg', '/catalogue?category=sneakers', 'Nouveau', 2),
('Collection Adultes', 'Élégance contemporaine pour adultes', '/images/collections/adult-collection.jpg', '/catalogue?category=adult', 'Populaire', 3),
('Collection Kids', 'Style et confort pour les plus jeunes', '/images/collections/kids-collection.jpg', '/catalogue?category=kids', 'Exclusif', 4);
