#!/bin/bash
# Script pour synchroniser la table product_variants avec les données de variants dans products

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
    echo -e "${MAGENTA}${BOLD}      SYNCHRONISATION DES VARIANTS PRODUITS      ${RESET}"
    echo -e "${MAGENTA}======================================================${RESET}"
    echo ""
}

# Fonction pour exécuter une requête SQL
function executer_sql() {
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Fonction pour synchroniser la table product_variants
function synchroniser_product_variants() {
    echo -e "\n${YELLOW}${BOLD}=== SYNCHRONISATION DES VARIANTS ===${RESET}"
    echo -e "${BLUE}Mise à jour de la table product_variants...${RESET}"
    
    # Vérifier si la table product_variants existe
    local table_existe=$(executer_sql "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_variants');")
    
    if [[ "$table_existe" != "t" ]]; then
        echo -e "${RED}Erreur: La table product_variants n'existe pas dans la base de données.${RESET}"
        echo -e "${YELLOW}Veuillez créer la table avant d'exécuter ce script.${RESET}"
        return 1
    fi
    
    # Compter le nombre de produits avec des variants
    local nombre_produits_avec_variants=$(executer_sql "
        SELECT COUNT(*) FROM products 
        WHERE variants IS NOT NULL 
        AND variants != '[]'::jsonb 
        AND variants != 'null'::jsonb;
    ")
    
    echo -e "${BLUE}Produits avec variants trouvés: $nombre_produits_avec_variants${RESET}"
    
    # Afficher quelques exemples de variants pour le diagnostic
    echo -e "${BLUE}Exemples de variants dans la base de données:${RESET}"
    local exemples=$(executer_sql "
        SELECT id, name, variants::text 
        FROM products 
        WHERE variants IS NOT NULL 
        AND variants != '[]'::jsonb 
        AND variants != 'null'::jsonb 
        LIMIT 3;
    ")
    echo "$exemples"
    
    # Vider la table product_variants
    echo -e "${YELLOW}Vidage de la table product_variants...${RESET}"
    executer_sql "TRUNCATE TABLE product_variants;"
    echo -e "${GREEN}Table product_variants vidée.${RESET}"
    
    # Re-remplir la table à partir des données JSON dans products.variants
    echo -e "${YELLOW}Insertion des variants dans product_variants...${RESET}"

    # Utiliser executer_sql mais sans capturer la sortie pour éviter les erreurs
    executer_sql "
        INSERT INTO product_variants (
            products_id,
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
            v.value ->> 'size' AS taille,
            v.value ->> 'color' AS couleur,
            (v.value ->> 'stock')::INTEGER AS stock,
            p.name,
            p.store_reference,
            p.category_id,
            p.brand_id,
            p.price,
            p.active
        FROM products p, jsonb_array_elements(
            CASE 
                WHEN p.variants IS NULL THEN '[]'::jsonb
                WHEN p.variants::text = 'null' THEN '[]'::jsonb
                ELSE p.variants
            END
        ) AS v(value)
        WHERE p.variants IS NOT NULL 
        AND p.variants != '[]'::jsonb 
        AND p.variants != 'null'::jsonb;
    " > /dev/null 2>&1
    
    # Vérifier le nombre de variants insérés
    local nombre_variants=$(executer_sql "SELECT COUNT(*) FROM product_variants;")
    
    echo -e "${GREEN}Table product_variants mise à jour avec $nombre_variants variant(s).${RESET}"
    
    # Si aucun variant n'a été inséré mais qu'il y a des produits avec variants, afficher un avertissement
    if [[ "$nombre_variants" -eq "0" && "$nombre_produits_avec_variants" -gt "0" ]]; then
        echo -e "${RED}AVERTISSEMENT: Aucun variant n'a été inséré malgré $nombre_produits_avec_variants produits avec variants.${RESET}"
        echo -e "${YELLOW}Cela peut indiquer un problème avec le format JSON des variants.${RESET}"
        
        # Afficher un exemple de format attendu
        echo -e "${BLUE}Format attendu pour les variants: [{ \"size\": \"EU 42\", \"color\": \"Noir\", \"stock\": 3 }]${RESET}"
        
        # Vérifier plus en détail si les variants sont au bon format
        local format_check=$(executer_sql "
            SELECT id, name, variants::text,
            jsonb_typeof(variants) AS type
            FROM products 
            WHERE variants IS NOT NULL 
            LIMIT 5;
        ")
        
        echo -e "${YELLOW}Détails des variants pour diagnostic:${RESET}"
        echo "$format_check"
    fi
    
    # Afficher les 10 premiers variants pour vérification
    if [[ "$nombre_variants" -gt "0" ]]; then
        echo -e "\n${YELLOW}${BOLD}=== APERÇU DES VARIANTS SYNCHRONISÉS (10 premiers) ===${RESET}"
        local apercu=$(executer_sql "
            SELECT pv.products_id, p.store_reference, p.name, pv.taille, pv.couleur, pv.stock
            FROM product_variants pv
            JOIN products p ON p.id = pv.products_id
            LIMIT 10;
        ")
        echo "$apercu"
    fi
}

# Fonction pour afficher les stats de variants
function afficher_stats_variants() {
    echo -e "\n${YELLOW}${BOLD}=== STATISTIQUES DES VARIANTS ===${RESET}"
    
    # Nombre total de produits
    local total_produits=$(executer_sql "SELECT COUNT(*) FROM products;")
    echo -e "${BLUE}Nombre total de produits: $total_produits${RESET}"
    
    # Nombre de produits avec variants
    local produits_avec_variants=$(executer_sql "
        SELECT COUNT(*) FROM products 
        WHERE variants IS NOT NULL 
        AND variants != '[]'::jsonb 
        AND variants != 'null'::jsonb;
    ")
    echo -e "${BLUE}Produits avec variants: $produits_avec_variants${RESET}"
    
    # Nombre total de variants
    local total_variants=$(executer_sql "SELECT COUNT(*) FROM product_variants;")
    echo -e "${BLUE}Nombre total de variants: $total_variants${RESET}"
    
    # Moyenne de variants par produit
    if [[ "$produits_avec_variants" -gt "0" ]]; then
        local moyenne=$(echo "scale=2; $total_variants / $produits_avec_variants" | bc)
        echo -e "${BLUE}Moyenne de variants par produit: $moyenne${RESET}"
    fi
    
    # Top 5 des produits avec le plus de variants
    echo -e "\n${CYAN}${BOLD}Top 5 des produits avec le plus de variants:${RESET}"
    local top_variants=$(executer_sql "
        SELECT p.id, p.name, p.store_reference, COUNT(pv.id) as nb_variants
        FROM products p
        JOIN product_variants pv ON p.id = pv.products_id
        GROUP BY p.id, p.name, p.store_reference
        ORDER BY nb_variants DESC
        LIMIT 5;
    ")
    echo "$top_variants"
}

# Fonction pour vérifier et corriger les variants malformés
function verifier_variants_malformes() {
    echo -e "\n${YELLOW}${BOLD}=== VÉRIFICATION DES VARIANTS MALFORMÉS ===${RESET}"
    
    # Rechercher les variants qui ne sont pas au format JSON array
    local variants_malformes=$(executer_sql "
        SELECT id, name, store_reference, variants::text 
        FROM products 
        WHERE variants IS NOT NULL 
        AND jsonb_typeof(variants) != 'array';
    ")
    
    if [[ -z "$variants_malformes" ]]; then
        echo -e "${GREEN}Aucun variant malformé trouvé.${RESET}"
    else
        echo -e "${RED}Variants malformés trouvés:${RESET}"
        echo "$variants_malformes"
        
        read -p "Voulez-vous corriger automatiquement ces variants ? (o/n): " reponse
        if [[ "$reponse" == "o"* ]]; then
            executer_sql "
                UPDATE products 
                SET variants = '[]'::jsonb 
                WHERE variants IS NOT NULL 
                AND jsonb_typeof(variants) != 'array';
            "
            echo -e "${GREEN}Variants malformés corrigés.${RESET}"
        fi
    fi
    
    # Rechercher les variants dont la structure interne n'est pas correcte
    echo -e "\n${YELLOW}Vérification des variants avec structure interne incorrecte...${RESET}"
    local variants_structure_incorrecte=$(executer_sql "
        SELECT p.id, p.name, p.store_reference, p.variants::text
        FROM products p
        WHERE p.variants IS NOT NULL 
        AND p.variants != '[]'::jsonb
        AND p.variants != 'null'::jsonb
        AND NOT EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(p.variants) as elem
            WHERE elem ? 'size' AND elem ? 'color' AND elem ? 'stock'
        )
        LIMIT 10;
    ")
    
    if [[ -z "$variants_structure_incorrecte" ]]; then
        echo -e "${GREEN}Tous les variants ont une structure interne correcte.${RESET}"
    else
        echo -e "${RED}Variants avec structure interne incorrecte:${RESET}"
        echo "$variants_structure_incorrecte"
        
        read -p "Voulez-vous corriger automatiquement ces variants ? (o/n): " reponse
        if [[ "$reponse" == "o"* ]]; then
            executer_sql "
                UPDATE products 
                SET variants = '[]'::jsonb 
                WHERE id IN (
                    SELECT p.id
                    FROM products p
                    WHERE p.variants IS NOT NULL 
                    AND p.variants != '[]'::jsonb
                    AND p.variants != 'null'::jsonb
                    AND NOT EXISTS (
                        SELECT 1 
                        FROM jsonb_array_elements(p.variants) as elem
                        WHERE elem ? 'size' AND elem ? 'color' AND elem ? 'stock'
                    )
                );
            "
            echo -e "${GREEN}Variants avec structure incorrecte corrigés.${RESET}"
        fi
    fi
}

# Menu principal
function menu_principal() {
    while true; do
        afficher_entete
        echo -e "${YELLOW}${BOLD}=== MENU PRINCIPAL ===${RESET}"
        echo -e "${CYAN}1. Synchroniser les variants${RESET}"
        echo -e "${CYAN}2. Afficher les statistiques des variants${RESET}"
        echo -e "${CYAN}3. Vérifier et corriger les variants malformés${RESET}"
        echo -e "${CYAN}0. Quitter${RESET}"
        
        read -p "Votre choix (0-3): " choix
        
        case $choix in
            0)
                echo -e "${GREEN}Au revoir!${RESET}"
                exit 0
                ;;
            1)
                synchroniser_product_variants
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
            2)
                afficher_stats_variants
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
            3)
                verifier_variants_malformes
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
            *)
                echo -e "${RED}Choix invalide. Veuillez réessayer.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
        esac
    done
}

# Point d'entrée du script
menu_principal 