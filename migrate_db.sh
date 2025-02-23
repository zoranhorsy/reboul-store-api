#!/bin/bash

# Export des URLs de connexion
export SUPABASE_DB_URL="postgresql://postgres:DTDgjwuEWk0o3Iis@db.imshohofssmnexditciw.supabase.co:5432/postgres"
export RAILWAY_DB_URL="postgresql://postgres:wuRWzXkTzKjXDFradojRvRtTDiSuOXos@nozomi.proxy.rlwy.net:14067/railway"

# Création du répertoire temporaire
mkdir -p /tmp/migration

echo "Test de connexion à Supabase..."
if ! psql "$SUPABASE_DB_URL" -c '\q'; then
    echo "Erreur de connexion à Supabase"
    exit 1
fi

echo "Test de connexion à Railway..."
if ! psql "$RAILWAY_DB_URL" -c '\q'; then
    echo "Erreur de connexion à Railway"
    exit 1
fi

echo "Export des données depuis Supabase..."
psql "$SUPABASE_DB_URL" << EOF
\copy (SELECT id, username, email, password_hash, first_name, last_name, is_admin, created_at, notification_settings FROM users) TO '/tmp/users.csv' WITH CSV HEADER;
\copy (SELECT id, name, description, created_at, updated_at FROM categories) TO '/tmp/categories.csv' WITH CSV HEADER;
\copy (SELECT id, name, description, price, old_price, stock, category_id, brand, image_url, images, variants, tags, details, store_type, featured, created_at FROM products) TO '/tmp/products.csv' WITH CSV HEADER;
\copy (SELECT id, name, description, logo_url, created_at, updated_at FROM brands) TO '/tmp/brands.csv' WITH CSV HEADER;
EOF

echo "Vérification des fichiers exportés..."
if [ ! -f "/tmp/users.csv" ] || [ ! -f "/tmp/categories.csv" ] || [ ! -f "/tmp/products.csv" ] || [ ! -f "/tmp/brands.csv" ]; then
    echo "Erreur: Un ou plusieurs fichiers CSV n'ont pas été créés"
    exit 1
fi

echo "Création de la structure de la base de données sur Railway..."
psql "$RAILWAY_DB_URL" -f schema.sql

echo "Import des données dans Railway..."
psql "$RAILWAY_DB_URL" << EOF
-- Import des données
\copy users(id, username, email, password_hash, first_name, last_name, is_admin, created_at, notification_settings) FROM '/tmp/users.csv' WITH CSV HEADER;
\copy categories(id, name, description, created_at, updated_at) FROM '/tmp/categories.csv' WITH CSV HEADER;
\copy products(id, name, description, price, old_price, stock, category_id, brand, image_url, images, variants, tags, details, store_type, featured, created_at) FROM '/tmp/products.csv' WITH CSV HEADER;
\copy brands(id, name, description, logo_url, created_at, updated_at) FROM '/tmp/brands.csv' WITH CSV HEADER;

-- Mise à jour des séquences
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));
SELECT setval('brands_id_seq', (SELECT MAX(id) FROM brands));
EOF

echo "Vérification finale..."
echo "Nombre d'utilisateurs:"
psql "$RAILWAY_DB_URL" -c "SELECT COUNT(*) FROM users;"
echo "Nombre de produits:"
psql "$RAILWAY_DB_URL" -c "SELECT COUNT(*) FROM products;"
echo "Nombre de catégories:"
psql "$RAILWAY_DB_URL" -c "SELECT COUNT(*) FROM categories;"
echo "Nombre de marques:"
psql "$RAILWAY_DB_URL" -c "SELECT COUNT(*) FROM brands;"

echo "Migration terminée avec succès!" 