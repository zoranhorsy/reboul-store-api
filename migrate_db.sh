#!/bin/bash

# Configuration des connexions
export SUPABASE_DB_URL="postgres://postgres:DTDgjwuEWk0o3Iis@db.imshohofssmnexditciw.supabase.co:5432/postgres"
export RAILWAY_DB_URL="postgresql://postgres:wuRWzXkTzKjXDFradojRvRtTDiSuOXos@nozomi.proxy.rlwy.net:14067/railway"

# Créer le dossier temporaire
echo "Création du dossier temporaire..."
mkdir -p /tmp/db_migration

# Test de connexion à Supabase
echo "Test de connexion à Supabase..."
if ! PGPASSWORD=DTDgjwuEWk0o3Iis psql -h db.imshohofssmnexditciw.supabase.co -U postgres -d postgres -c '\q'; then
    echo "Erreur: Impossible de se connecter à Supabase"
    exit 1
fi

# Test de connexion à Railway
echo "Test de connexion à Railway..."
if ! psql "$RAILWAY_DB_URL" -c '\q'; then
    echo "Erreur: Impossible de se connecter à Railway"
    exit 1
fi

# Export depuis Supabase
echo "Export des données depuis Supabase..."
PGPASSWORD=DTDgjwuEWk0o3Iis psql -h db.imshohofssmnexditciw.supabase.co -U postgres -d postgres -f export_data.sql

# Vérification des fichiers exportés
echo "Vérification des fichiers exportés..."
for file in users.csv categories.csv products.csv orders.csv order_items.csv addresses.csv reviews.csv favorites.csv; do
    if [ ! -f "/tmp/$file" ]; then
        echo "Erreur: Le fichier $file n'a pas été créé"
        exit 1
    fi
done

# Création des tables dans Railway
echo "Création des tables dans Railway..."
psql "$RAILWAY_DB_URL" -f supabase_import_corrected.sql

# Import dans Railway
echo "Import des données dans Railway..."
psql "$RAILWAY_DB_URL" -f import_data.sql

# Vérification finale
echo "Vérification des données importées..."
psql "$RAILWAY_DB_URL" -c "SELECT COUNT(*) FROM users;" -c "SELECT COUNT(*) FROM products;" -c "SELECT COUNT(*) FROM categories;"

echo "Migration terminée avec succès !" 