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
psql "$SUPABASE_DB_URL" -f export_data.sql

echo "Vérification des fichiers exportés..."
if [ ! -f "/tmp/users.csv" ]; then
    echo "Erreur: Le fichier users.csv n'a pas été créé"
    exit 1
fi

echo "Création de la structure de la base de données sur Railway..."
psql "$RAILWAY_DB_URL" -f schema.sql

echo "Import des données dans Railway..."
psql "$RAILWAY_DB_URL" -f import_data.sql

echo "Vérification finale..."
echo "Nombre d'utilisateurs:"
psql "$RAILWAY_DB_URL" -c "SELECT COUNT(*) FROM users;"
echo "Nombre de produits:"
psql "$RAILWAY_DB_URL" -c "SELECT COUNT(*) FROM products;"
echo "Nombre de catégories:"
psql "$RAILWAY_DB_URL" -c "SELECT COUNT(*) FROM categories;"

echo "Migration terminée avec succès !" 