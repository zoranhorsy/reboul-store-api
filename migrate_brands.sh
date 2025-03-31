#!/bin/bash

# Configuration des connexions
export LOCAL_DB_URL="postgresql://postgres@localhost:5432/reboul_store"
export RAILWAY_DB_URL="postgresql://postgres:wuRWzXkTzKjXDFradojRvRtTDiSuOXos@nozomi.proxy.rlwy.net:14067/railway"

# URL de base de l'API
API_URL="https://reboul-store-api-production.up.railway.app"

echo "Migration de la table brands depuis PostgreSQL local..."

# Test de connexion à la base locale
echo "Test de connexion à la base PostgreSQL locale..."
if ! psql "$LOCAL_DB_URL" -c 'SELECT COUNT(*) FROM brands;' > /dev/null 2>&1; then
    echo "Tentative de connexion avec un autre utilisateur..."
    export LOCAL_DB_URL="postgresql://tripleseptinteractive@localhost:5432/reboul_store"
    if ! psql "$LOCAL_DB_URL" -c 'SELECT COUNT(*) FROM brands;' > /dev/null 2>&1; then
        echo "Erreur: La table brands n'existe pas dans la base locale"
        echo "Veuillez vérifier que:"
        echo "1. PostgreSQL est en cours d'exécution"
        echo "2. La base de données reboul_store existe"
        echo "3. La table brands existe dans la base de données"
        echo "4. Vous avez les permissions nécessaires"
        exit 1
    fi
fi

echo "Nombre de marques dans la base locale:"
psql "$LOCAL_DB_URL" -c 'SELECT COUNT(*) FROM brands;'

# Test de connexion à Railway
echo "Test de connexion à Railway..."
if ! psql "$RAILWAY_DB_URL" -c '\q'; then
    echo "Erreur de connexion à Railway"
    exit 1
fi

# Export des marques de la base locale avec transformation des colonnes
echo "Export des marques depuis PostgreSQL local..."
psql "$LOCAL_DB_URL" -c "\copy (
    SELECT 
        id,
        name,
        name || ' - Marque de vêtements' as description,
        CASE name
            WHEN 'C.P.COMPANY' THEN '$API_URL/brands/CP COMPANY/cp_2_b.png'
            WHEN 'STONE ISLAND' THEN '$API_URL/brands/STONE ISLAND/stone_island_2_b.png'
            WHEN 'RRD' THEN '$API_URL/brands/RRD/rrd_b.png'
            WHEN 'APC' THEN '$API_URL/brands/APC/apc_b.png'
            WHEN 'AXEL ARIGATO' THEN '$API_URL/brands/AXEL ARIGATO/axel_b.png'
            WHEN 'HERNO' THEN '$API_URL/brands/HERNO/herno_b.png'
            WHEN 'LES DEUX' THEN '$API_URL/brands/LESDEUX/lesdeux_b.png'
            WHEN 'OFF-WHITE' THEN '$API_URL/brands/OFF-WHITE/off_white_b.png'
            WHEN 'PALM ANGELS' THEN '$API_URL/brands/PALM ANGELS/palmangels_b.png'
            WHEN 'AUTRY' THEN '$API_URL/brands/AUTRY/autry_b.png'
            WHEN 'SALOMON' THEN '$API_URL/brands/SALOMON/salomon_2_b.png'
            WHEN 'JACOB COHEN' THEN '$API_URL/brands/JACOBCOHEN/jacob_b.png'
            WHEN 'MARNI' THEN '$API_URL/brands/MARNI/marni_b.png'
            WHEN 'PATAGONIA' THEN '$API_URL/brands/PATAGONIA/patagonia_b.png'
            WHEN 'TOPOLOGIE' THEN '$API_URL/brands/TOPOLOGIE/topo_b.png'
            WHEN 'CARHART' THEN '$API_URL/brands/CARHARTT/carhartt_b.png'
            WHEN 'ARTE' THEN '$API_URL/brands/ARTE/arte_b.png'
            WHEN 'DOUCAL''S' THEN '$API_URL/brands/DOUCALS/doucals_b.png'
            ELSE '$API_URL/brands/' || REPLACE(UPPER(name), ' ', '') || '/' || LOWER(REPLACE(name, ' ', '')) || '_b.png'
        END as logo_url,
        NOW() as created_at,
        NOW() as updated_at
    FROM brands
) TO '/tmp/brands_local.csv' WITH CSV HEADER;"

# Vérification du fichier exporté
if [ ! -f "/tmp/brands_local.csv" ]; then
    echo "Erreur: Le fichier brands_local.csv n'a pas été créé"
    exit 1
fi

# Import dans Railway
echo "Import des marques dans Railway..."
psql "$RAILWAY_DB_URL" << EOF
-- Suppression des données existantes dans la table brands
TRUNCATE TABLE brands RESTART IDENTITY CASCADE;

-- Import des nouvelles données
\copy brands FROM '/tmp/brands_local.csv' WITH CSV HEADER;

-- Mise à jour de la séquence
SELECT setval('brands_id_seq', (SELECT MAX(id) FROM brands));
EOF

# Vérification
echo "Vérification des marques migrées..."
echo "Nombre de marques dans Railway:"
psql "$RAILWAY_DB_URL" -c "SELECT COUNT(*) FROM brands;"
echo "Liste des marques migrées:"
psql "$RAILWAY_DB_URL" -c "SELECT id, name, description, logo_url FROM brands ORDER BY id;"

# Nettoyage
rm -f /tmp/brands_local.csv

echo "Migration des marques terminée avec succès!"

# Définir les chemins
FRONTEND_BRANDS_DIR="../public/brands"
BACKEND_BRANDS_DIR="public/brands"

echo "Copie des images des marques depuis le frontend..."

# Créer le dossier de destination s'il n'existe pas
mkdir -p "$BACKEND_BRANDS_DIR"

# Liste des marques
BRANDS=(
    "CP COMPANY"
    "STONE ISLAND"
    "SALOMON"
    "PALM ANGELS"
    "OFF-WHITE"
)

# Copier les images pour chaque marque
for brand in "${BRANDS[@]}"; do
    # Créer le dossier de la marque
    brand_dir="$BACKEND_BRANDS_DIR/${brand}"
    mkdir -p "$brand_dir"
    
    # Copier les images
    if [ -d "$FRONTEND_BRANDS_DIR/${brand}" ]; then
        echo "Copie des images pour ${brand}..."
        cp -r "$FRONTEND_BRANDS_DIR/${brand}"/* "$brand_dir/"
        echo "Images copiées pour ${brand}"
    else
        echo "Dossier source introuvable pour ${brand}"
    fi
done

echo "Copie des images terminée"

# Afficher la structure des dossiers
echo "Structure des dossiers des marques :"
ls -R "$BACKEND_BRANDS_DIR"