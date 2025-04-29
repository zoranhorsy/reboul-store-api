#!/bin/bash

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
    echo -e "${MAGENTA}${BOLD}        GESTIONNAIRE DE VARIANTS THE CORNER     ${RESET}"
    echo -e "${MAGENTA}======================================================${RESET}"
    echo ""
}

# Fonction pour exécuter une requête SQL
function executer_sql() {
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Fonction pour mettre à jour le stock d'un variant
function mettre_a_jour_stock() {
    local variant_id=$1
    local nouveau_stock=$2
    
    # Récupérer les informations du variant avant la mise à jour
    local variant_info=$(executer_sql "
        SELECT corner_product_id, taille, couleur 
        FROM corner_product_variants 
        WHERE id = $variant_id;
    ")
    
    IFS='|' read -r product_id taille couleur <<< "$variant_info"
    
    # Mettre à jour dans la table corner_product_variants
    executer_sql "
        UPDATE corner_product_variants 
        SET stock = $nouveau_stock 
        WHERE id = $variant_id;
    "
    
    # Construire le nouveau variant JSON
    local variant_json="{\"size\": \"$taille\", \"color\": \"$couleur\", \"stock\": $nouveau_stock}"
    
    # Vérifier si le produit a déjà des variants
    local has_variants=$(executer_sql "
        SELECT CASE 
            WHEN variants IS NULL OR variants = 'null'::jsonb OR variants = '[]'::jsonb 
            THEN 'false' 
            ELSE 'true' 
        END 
        FROM corner_products 
        WHERE id = $product_id;
    ")
    
    if [ "$has_variants" = "true" ]; then
        # Mettre à jour le variant existant dans le tableau
        executer_sql "
            UPDATE corner_products 
            SET variants = (
                SELECT jsonb_agg(
                    CASE 
                        WHEN v->>'size' = '$taille' AND v->>'color' = '$couleur' 
                        THEN '$variant_json'::jsonb
                        ELSE v 
                    END
                )
                FROM jsonb_array_elements(variants) v
            )
            WHERE id = $product_id;
        "
    else
        # Créer un nouveau tableau avec le variant
        executer_sql "
            UPDATE corner_products 
            SET variants = '[$variant_json]'::jsonb
            WHERE id = $product_id;
        "
    fi
    
    echo -e "${GREEN}Stock mis à jour avec succès.${RESET}"
}

# Fonction pour mettre à jour le prix du produit
function mettre_a_jour_prix() {
    local product_id=$1
    local nouveau_prix=$2
    
    # Mettre à jour le prix du produit
    executer_sql "
        UPDATE corner_products 
        SET price = $nouveau_prix 
        WHERE id = $product_id;
    "
    
    # Mettre à jour le prix dans la table variants
    executer_sql "
        UPDATE corner_product_variants 
        SET price = $nouveau_prix 
        WHERE corner_product_id = $product_id;
    "
    
    echo -e "${GREEN}Prix du produit mis à jour avec succès.${RESET}"
}

# Fonction pour afficher les variants d'un produit
function afficher_variants() {
    local product_id=$1
    
    echo -e "\n${YELLOW}${BOLD}=== VARIANTS DU PRODUIT ===${RESET}"
    
    # Afficher d'abord les informations du produit
    local product_info=$(executer_sql "
        SELECT name, store_reference, price 
        FROM corner_products 
        WHERE id = $product_id;
    ")
    
    IFS='|' read -r nom reference prix <<< "$product_info"
    
    echo -e "\n${CYAN}Informations du produit :${RESET}"
    echo -e "Nom: $nom"
    echo -e "Référence: $reference"
    echo -e "Prix: $prix €"
    
    # Afficher les variants
    echo -e "\n${CYAN}Variants disponibles :${RESET}"
    local variants=$(executer_sql "
        SELECT v.id, v.taille, v.couleur, v.stock
        FROM corner_product_variants v
        WHERE v.corner_product_id = $product_id
        ORDER BY v.taille, v.couleur;
    ")
    
    if [ -z "$variants" ]; then
        echo -e "${RED}Aucun variant trouvé pour ce produit.${RESET}"
        return
    fi
    
    echo -e "${CYAN}ID | Taille | Couleur | Stock${RESET}"
    echo "$variants"
}

# Fonction pour rechercher un produit
function rechercher_produit() {
    echo -e "\n${YELLOW}${BOLD}=== RECHERCHE DE PRODUIT ===${RESET}"
    read -p "Entrez la référence ou une partie du nom du produit: " recherche
    
    local produits=$(executer_sql "
        SELECT id, name, store_reference, price 
        FROM corner_products 
        WHERE store_reference ILIKE '%$recherche%' 
        OR name ILIKE '%$recherche%'
        ORDER BY id
        LIMIT 10;
    ")
    
    if [ -z "$produits" ]; then
        echo -e "${RED}Aucun produit trouvé.${RESET}"
        return
    fi
    
    echo -e "\n${CYAN}Produits trouvés :${RESET}"
    echo "$produits"
    
    read -p "Entrez l'ID du produit à gérer (ou 0 pour annuler): " product_id
    
    if [ "$product_id" != "0" ]; then
        afficher_variants "$product_id"
        
        echo -e "\n${YELLOW}${BOLD}=== GESTION DES VARIANTS ===${RESET}"
        echo -e "${CYAN}1. Mettre à jour le stock d'un variant${RESET}"
        echo -e "${CYAN}2. Mettre à jour le prix du produit${RESET}"
        echo -e "${CYAN}0. Retour${RESET}"
        
        read -p "Votre choix: " choix
        
        case $choix in
            1)
                read -p "ID du variant à modifier: " variant_id
                read -p "Nouveau stock: " nouveau_stock
                if [[ "$nouveau_stock" =~ ^[0-9]+$ ]]; then
                    mettre_a_jour_stock "$variant_id" "$nouveau_stock"
                else
                    echo -e "${RED}Le stock doit être un nombre entier.${RESET}"
                fi
                ;;
            2)
                read -p "Nouveau prix: " nouveau_prix
                if [[ "$nouveau_prix" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]]; then
                    mettre_a_jour_prix "$product_id" "$nouveau_prix"
                else
                    echo -e "${RED}Le prix doit être un nombre (ex: 99.99).${RESET}"
                fi
                ;;
        esac
    fi
}

# Point d'entrée du script
while true; do
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== MENU PRINCIPAL ===${RESET}"
    echo -e "${CYAN}1. Rechercher un produit${RESET}"
    echo -e "${CYAN}0. Quitter${RESET}"
    
    read -p "Votre choix: " choix
    
    case $choix in
        0)
            echo -e "${GREEN}Au revoir!${RESET}"
            exit 0
            ;;
        1)
            rechercher_produit
            read -p "Appuyez sur Entrée pour continuer..."
            ;;
        *)
            echo -e "${RED}Choix invalide.${RESET}"
            read -p "Appuyez sur Entrée pour continuer..."
            ;;
    esac
done 