#!/bin/bash
# Script pour gérer les variants des produits The Corner

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
    echo -e "${MAGENTA}${BOLD}         GESTION DES VARIANTS THE CORNER         ${RESET}"
    echo -e "${MAGENTA}======================================================${RESET}"
    echo ""
}

# Fonction pour exécuter une requête SQL
function executer_sql() {
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Fonction pour vérifier si un produit existe
function produit_existe() {
    local ref="$1"
    local ref_escape=$(echo "$ref" | sed "s/'/''/g")
    local count=$(executer_sql "SELECT COUNT(*) FROM corner_products WHERE store_reference = '$ref_escape'")
    
    if [ "$count" -gt "0" ]; then
        return 0 # True
    else
        return 1 # False
    fi
}

# Fonction pour obtenir l'ID d'un produit à partir de sa référence
function obtenir_produit_id() {
    local ref="$1"
    local ref_escape=$(echo "$ref" | sed "s/'/''/g")
    local id=$(executer_sql "SELECT id FROM corner_products WHERE store_reference = '$ref_escape'")
    echo "$id"
}

# Fonction pour afficher les variants d'un produit
function afficher_variants() {
    local produit_id="$1"
    local variants=$(executer_sql "SELECT id, taille, couleur, stock, price FROM corner_product_variants WHERE corner_product_id = $produit_id ORDER BY id")
    
    if [ -z "$variants" ]; then
        echo -e "${YELLOW}Aucun variant trouvé pour ce produit.${RESET}"
        return
    fi
    
    echo -e "${CYAN}${BOLD}=== VARIANTS EXISTANTS ===${RESET}"
    echo -e "${BLUE}ID | Taille | Couleur | Stock | Prix${RESET}"
    echo "$variants" | while IFS='|' read -r id taille couleur stock prix; do
        echo -e "${GREEN}$id | $taille | $couleur | $stock | $prix${RESET}"
    done
}

# Fonction pour ajouter un variant
function ajouter_variant() {
    local produit_id="$1"
    
    echo -e "\n${CYAN}${BOLD}=== AJOUT D'UN NOUVEAU VARIANT ===${RESET}"
    
    # Obtenir les détails du variant
    read -p "Taille (ex: EU 42): " taille
    read -p "Couleur: " couleur
    read -p "Stock: " stock
    read -p "Prix spécifique (laisser vide pour utiliser le prix du produit): " prix_variant
    
    # Vérifier que le stock est un nombre
    if ! [[ "$stock" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Erreur: Le stock doit être un nombre entier.${RESET}"
        return 1
    fi
    
    # Vérifier que le prix est un nombre si fourni
    if [ ! -z "$prix_variant" ] && ! [[ "$prix_variant" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]]; then
        echo -e "${RED}Erreur: Le prix doit être un nombre (ex: 99.99).${RESET}"
        return 1
    fi
    
    # Créer le variant dans la table corner_product_variants
    local variant_query="INSERT INTO corner_product_variants 
        (corner_product_id, taille, couleur, stock, product_name, store_reference, category_id, brand_id, price, active) 
        SELECT $produit_id, '$taille', '$couleur', $stock, name, store_reference, category_id, brand_id, 
        ${prix_variant:-price}, true 
        FROM corner_products WHERE id = $produit_id RETURNING id"
    
    local variant_id=$(executer_sql "$variant_query")
    
    if [ -z "$variant_id" ]; then
        echo -e "${RED}Erreur lors de la création du variant.${RESET}"
        return 1
    fi
    
    # Mettre à jour has_variants sur le produit
    executer_sql "UPDATE corner_products SET has_variants = true WHERE id = $produit_id"
    
    echo -e "${GREEN}Variant créé avec succès! ID: $variant_id${RESET}"
    return 0
}

# Fonction pour modifier un variant
function modifier_variant() {
    local variant_id="$1"
    
    echo -e "\n${CYAN}${BOLD}=== MODIFICATION DU VARIANT ===${RESET}"
    
    # Afficher les informations actuelles du variant
    local variant_info=$(executer_sql "SELECT taille, couleur, stock, price FROM corner_product_variants WHERE id = $variant_id")
    IFS='|' read -r taille_actuelle couleur_actuelle stock_actuel prix_actuel <<< "$variant_info"
    
    echo -e "${BLUE}Informations actuelles:${RESET}"
    echo -e "Taille: $taille_actuelle"
    echo -e "Couleur: $couleur_actuelle"
    echo -e "Stock: $stock_actuel"
    echo -e "Prix: $prix_actuel"
    echo ""
    
    # Demander les nouvelles valeurs
    read -p "Nouvelle taille (laisser vide pour garder '$taille_actuelle'): " taille
    read -p "Nouvelle couleur (laisser vide pour garder '$couleur_actuelle'): " couleur
    read -p "Nouveau stock (laisser vide pour garder '$stock_actuel'): " stock
    read -p "Nouveau prix (laisser vide pour garder '$prix_actuel'): " prix
    
    # Utiliser les valeurs actuelles si aucune nouvelle valeur n'est fournie
    taille=${taille:-$taille_actuelle}
    couleur=${couleur:-$couleur_actuelle}
    stock=${stock:-$stock_actuel}
    prix=${prix:-$prix_actuel}
    
    # Vérifier que le stock est un nombre
    if ! [[ "$stock" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Erreur: Le stock doit être un nombre entier.${RESET}"
        return 1
    fi
    
    # Vérifier que le prix est un nombre
    if ! [[ "$prix" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]]; then
        echo -e "${RED}Erreur: Le prix doit être un nombre (ex: 99.99).${RESET}"
        return 1
    fi
    
    # Mettre à jour le variant
    local update_query="UPDATE corner_product_variants 
        SET taille = '$taille', 
            couleur = '$couleur', 
            stock = $stock, 
            price = $prix 
        WHERE id = $variant_id"
    
    executer_sql "$update_query"
    
    echo -e "${GREEN}Variant mis à jour avec succès!${RESET}"
    return 0
}

# Fonction pour supprimer un variant
function supprimer_variant() {
    local variant_id="$1"
    local produit_id="$2"
    
    echo -e "\n${RED}${BOLD}=== SUPPRESSION DU VARIANT ===${RESET}"
    echo -e "${RED}Attention: Cette action est irréversible!${RESET}"
    read -p "Êtes-vous sûr de vouloir supprimer ce variant? (o/n): " confirmation
    
    if [[ "$confirmation" == "o"* ]]; then
        # Supprimer le variant
        executer_sql "DELETE FROM corner_product_variants WHERE id = $variant_id"
        
        # Vérifier s'il reste des variants pour ce produit
        local variants_restants=$(executer_sql "SELECT COUNT(*) FROM corner_product_variants WHERE corner_product_id = $produit_id")
        
        if [ "$variants_restants" -eq "0" ]; then
            # Mettre à jour has_variants sur le produit
            executer_sql "UPDATE corner_products SET has_variants = false WHERE id = $produit_id"
        fi
        
        echo -e "${GREEN}Variant supprimé avec succès!${RESET}"
        return 0
    else
        echo -e "${BLUE}Suppression annulée.${RESET}"
        return 1
    fi
}

# Fonction principale pour gérer les variants d'un produit
function gerer_variants() {
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== GESTION DES VARIANTS D'UN PRODUIT ===${RESET}"
    echo -e "${BLUE}Connexion à la base de données Railway${RESET}"
    echo ""
    
    # Demander la référence du produit
    read -p "Entrez la référence du produit: " ref_produit
    
    if [ -z "$ref_produit" ]; then
        echo -e "${RED}Erreur: La référence du produit ne peut pas être vide.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Vérifier si le produit existe
    if ! produit_existe "$ref_produit"; then
        echo -e "${RED}Erreur: Aucun produit trouvé avec la référence '$ref_produit'.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Obtenir l'ID du produit
    local produit_id=$(obtenir_produit_id "$ref_produit")
    
    while true; do
        afficher_entete
        echo -e "${YELLOW}${BOLD}=== GESTION DES VARIANTS ===${RESET}"
        echo -e "${BLUE}Produit: $ref_produit (ID: $produit_id)${RESET}"
        echo ""
        
        # Afficher les variants existants
        afficher_variants "$produit_id"
        
        echo -e "\n${CYAN}${BOLD}=== ACTIONS DISPONIBLES ===${RESET}"
        echo -e "${CYAN}1. Ajouter un nouveau variant${RESET}"
        echo -e "${CYAN}2. Modifier un variant existant${RESET}"
        echo -e "${CYAN}3. Supprimer un variant${RESET}"
        echo -e "${CYAN}0. Retour au menu principal${RESET}"
        
        read -p "Votre choix (0-3): " choix
        
        case $choix in
            0)
                return 0
                ;;
            1)
                ajouter_variant "$produit_id"
                ;;
            2)
                echo -e "\n${YELLOW}Entrez l'ID du variant à modifier:${RESET}"
                read -p "ID: " variant_id
                if [ ! -z "$variant_id" ]; then
                    modifier_variant "$variant_id"
                fi
                ;;
            3)
                echo -e "\n${YELLOW}Entrez l'ID du variant à supprimer:${RESET}"
                read -p "ID: " variant_id
                if [ ! -z "$variant_id" ]; then
                    supprimer_variant "$variant_id" "$produit_id"
                fi
                ;;
            *)
                echo -e "${RED}Choix invalide. Veuillez réessayer.${RESET}"
                ;;
        esac
        
        read -p "Appuyez sur Entrée pour continuer..."
    done
}

# Point d'entrée du script
while true; do
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== MENU PRINCIPAL ===${RESET}"
    echo -e "${CYAN}1. Gérer les variants d'un produit${RESET}"
    echo -e "${CYAN}0. Quitter${RESET}"
    
    read -p "Votre choix (0-1): " choix
    
    case $choix in
        0)
            echo -e "${GREEN}Au revoir!${RESET}"
            exit 0
            ;;
        1)
            gerer_variants
            ;;
        *)
            echo -e "${RED}Choix invalide. Veuillez réessayer.${RESET}"
            read -p "Appuyez sur Entrée pour continuer..."
            ;;
    esac
done 