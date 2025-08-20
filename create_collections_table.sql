-- Création de la table collections_carousel
CREATE TABLE IF NOT EXISTS collections_carousel (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT NOT NULL,
    badge TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Création des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_collections_carousel_active ON collections_carousel(is_active);
CREATE INDEX IF NOT EXISTS idx_collections_carousel_sort_order ON collections_carousel(sort_order);

-- Insertion de quelques collections de démonstration
INSERT INTO collections_carousel (name, description, image_url, link_url, badge, sort_order, is_active) VALUES
    ('Collection CP Company', 'Design italien - Les essentiels CP Company', '/public/uploads/collections/cp-company.jpg', '/catalogue?brand=cp-company', 'Tendance', 1, true),
    ('Collection Sneakers', 'Les dernières nouveautés en sneakers', '/public/uploads/collections/sneakers-collection.jpg', '/catalogue?category=sneakers', 'Nouveau', 2, true),
    ('Collection Adultes', 'Élégance contemporaine pour adultes', '/public/uploads/collections/adult-collection.jpg', '/catalogue?category=adult', 'Populaire', 3, true),
    ('Collection Kids', 'Style et confort pour les plus jeunes', '/public/uploads/collections/kids-collection.jpg', '/catalogue?category=kids', 'Exclusif', 4, true)
ON CONFLICT DO NOTHING;
