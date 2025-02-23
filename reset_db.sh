#!/bin/bash

# URL de la base de données Railway
export DATABASE_URL="postgresql://postgres:wuRWzXkTzKjXDFradojRvRtTDiSuOXos@nozomi.proxy.rlwy.net:14067/railway"

echo "Réinitialisation de la base de données..."

# Appliquer le schéma
psql "$DATABASE_URL" -f schema.sql

# Insérer les données initiales
echo "Insertion des données initiales..."
psql "$DATABASE_URL" << EOF
-- Insérer quelques marques
INSERT INTO brands (name, description) VALUES 
('Nike', 'Marque de sport américaine'),
('Adidas', 'Marque de sport allemande'),
('Stone Island', 'Marque italienne de vêtements haut de gamme'),
('C.P. Company', 'Marque italienne de sportswear'),
('Under Armour', 'Marque de sport américaine');

-- Mettre à jour les produits existants avec les marques
UPDATE products SET brand = 'Nike' WHERE brand ILIKE '%nike%';
UPDATE products SET brand = 'Adidas' WHERE brand ILIKE '%adidas%';
UPDATE products SET brand = 'Stone Island' WHERE brand ILIKE '%stone%';
UPDATE products SET brand = 'C.P. Company' WHERE brand ILIKE '%cp%';
UPDATE products SET brand = 'Under Armour' WHERE brand ILIKE '%under%';
EOF

echo "Base de données réinitialisée avec succès!" 