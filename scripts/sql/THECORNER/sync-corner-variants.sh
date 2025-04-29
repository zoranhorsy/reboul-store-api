#!/bin/bash
# Script pour synchroniser la table corner_product_variants avec les données de variants dans corner_products

# Configuration pour Railway
DB_USER="postgres"
DB_NAME="railway"
DB_PASSWORD="wuRWzXkTzKjXDFradojRvRtTDiSuOXos"
DB_HOST="nozomi.proxy.rlwy.net"
DB_PORT="14067"

# Couleurs pour l'affichage
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
RESET='\033[0m'

# Fonction pour effacer l'écran et afficher l'en-tête
function afficher_entete() {
    clear
    echo -e "${MAGENTA}======================================================${RESET}"
    echo -e "${MAGENTA}${BOLD}   SYNCHRONISATION DES VARIANTS THE CORNER      ${RESET}"
    echo -e "${MAGENTA}======================================================${RESET}"
    echo ""
}

# Fonction pour exécuter une requête SQL
function executer_sql() {
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Fonction pour synchroniser depuis la table variants vers le champ JSONB
function sync_table_vers_jsonb() {
    echo -e "\n${YELLOW}${BOLD}=== SYNCHRONISATION TABLE VERS JSONB ===${RESET}"
    
    # Compter le nombre de produits avec des variants dans la table
    local nombre_produits=$(executer_sql "
        SELECT COUNT(DISTINCT corner_product_id) 
        FROM corner_product_variants;
    ")
    
    echo -e "${BLUE}Produits avec variants dans la table: $nombre_produits${RESET}"
    
    # Pour chaque produit ayant des variants dans la table
    local produits=$(executer_sql "
        SELECT DISTINCT corner_product_id 
        FROM corner_product_variants;
    ")
    
    for product_id in $produits; do
        echo -e "\n${CYAN}Traitement du produit ID: $product_id${RESET}"
        
        # Construire le JSON des variants (sans le champ price)
        local variants_json=$(executer_sql "
            SELECT jsonb_agg(
                jsonb_build_object(
                    'size', taille,
                    'color', couleur,
                    'stock', stock
                )
            )
            FROM corner_product_variants
            WHERE corner_product_id = $product_id;
        ")
        
        # Mettre à jour le champ variants dans corner_products
        executer_sql "
            UPDATE corner_products
            SET variants = COALESCE('$variants_json'::jsonb, '[]'::jsonb)
            WHERE id = $product_id;
        "
    done
    
    echo -e "${GREEN}Synchronisation terminée : variants copiés de la table vers le champ JSONB.${RESET}"
}

# Fonction pour synchroniser depuis le champ JSONB vers la table variants
function sync_jsonb_vers_table() {
    echo -e "\n${YELLOW}${BOLD}=== SYNCHRONISATION JSONB VERS TABLE ===${RESET}"
    
    # Compter le nombre de produits avec des variants JSONB
    local nombre_produits=$(executer_sql "
        SELECT COUNT(*) FROM corner_products 
        WHERE variants IS NOT NULL 
        AND variants != '[]'::jsonb 
        AND variants != 'null'::jsonb;
    ")
    
    echo -e "${BLUE}Produits avec variants JSONB trouvés: $nombre_produits${RESET}"
    
    # Vider la table corner_product_variants
    echo -e "${YELLOW}Vidage de la table corner_product_variants...${RESET}"
    executer_sql "TRUNCATE TABLE corner_product_variants;"
    
    # Insérer les variants depuis le champ JSONB
    echo -e "${YELLOW}Insertion des variants dans la table...${RESET}"
    
    executer_sql "
        INSERT INTO corner_product_variants (
            corner_product_id,
            taille,
            couleur,
            stock,
            product_name,
            store_reference,
            category_id,
            brand_id,
            price,
            active
        )
        SELECT 
            p.id,
            v.value->>'size' AS taille,
            v.value->>'color' AS couleur,
            (v.value->>'stock')::INTEGER AS stock,
            p.price,
            p.name,
            p.store_reference,
            p.category_id,
            p.brand_id,
            p.active
        FROM corner_products p,
        jsonb_array_elements(
            CASE 
                WHEN p.variants IS NULL THEN '[]'::jsonb
                WHEN p.variants::text = 'null' THEN '[]'::jsonb
                ELSE p.variants
            END
        ) AS v(value)
        WHERE p.variants IS NOT NULL 
        AND p.variants != '[]'::jsonb 
        AND p.variants != 'null'::jsonb;
    "
    
    # Vérifier le nombre de variants insérés
    local nombre_variants=$(executer_sql "SELECT COUNT(*) FROM corner_product_variants;")
    echo -e "${GREEN}Synchronisation terminée : $nombre_variants variants copiés du champ JSONB vers la table.${RESET}"
}

# Menu principal
afficher_entete
echo -e "${YELLOW}${BOLD}=== CHOISISSEZ LA DIRECTION DE SYNCHRONISATION ===${RESET}"
echo -e "${CYAN}1. Synchroniser depuis la table variants vers le champ JSONB${RESET}"
echo -e "${CYAN}2. Synchroniser depuis le champ JSONB vers la table variants${RESET}"
echo -e "${CYAN}0. Quitter${RESET}"

read -p "Votre choix (0-2): " choix

case $choix in
    0)
        echo -e "${GREEN}Au revoir!${RESET}"
        exit 0
        ;;
    1)
        sync_table_vers_jsonb
        ;;
    2)
        sync_jsonb_vers_table
        ;;
    *)
        echo -e "${RED}Choix invalide.${RESET}"
        ;;
esac 