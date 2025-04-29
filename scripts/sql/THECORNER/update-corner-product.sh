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
    echo -e "${MAGENTA}${BOLD}     MISE À JOUR DE PRODUIT THE CORNER         ${RESET}"
    echo -e "${MAGENTA}======================================================${RESET}"
    echo ""
}

# Fonction pour exécuter une requête SQL
function executer_sql() {
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Fonction pour mettre à jour les variants
function mettre_a_jour_variants() {
    local produit_id="$1"
    local variants=()
    local continue_adding="y"
    
    # Afficher les variants actuels
    echo -e "\n${YELLOW}Variants actuels :${RESET}"
    executer_sql "
        SELECT v.id, v.taille, v.couleur, v.stock
        FROM corner_product_variants v
        WHERE v.corner_product_id = $produit_id
        ORDER BY v.taille, v.couleur;
    "
    
    echo -e "\n${YELLOW}${BOLD}=== MISE À JOUR DES VARIANTS ===${RESET}"
    echo -e "${CYAN}1. Ajouter de nouveaux variants${RESET}"
    echo -e "${CYAN}2. Supprimer tous les variants et en créer de nouveaux${RESET}"
    echo -e "${CYAN}3. Ne rien changer${RESET}"
    
    read -p "Votre choix (1-3): " choix_variants
    
    case $choix_variants in
        1)
            # Ajouter de nouveaux variants
            while [[ "$continue_adding" == "y" ]]; do
                echo -e "\n${GREEN}Nouveau variant :${RESET}"
                
                read -p "Couleur: " color
                read -p "Taille: " size
                read -p "Stock: " stock
                
                # Validation du stock
                if ! [[ "$stock" =~ ^[0-9]+$ ]]; then
                    echo -e "${RED}Le stock doit être un nombre entier${RESET}"
                    continue
                fi
                
                # Ajouter le variant au tableau
                variants+=("{\"color\": \"$color\", \"size\": \"$size\", \"stock\": $stock}")
                
                read -p "Ajouter un autre variant? (y/n): " continue_adding
            done
            
            # Récupérer les variants existants
            local variants_existants=$(executer_sql "
                SELECT variants::text FROM corner_products WHERE id = $produit_id;
            ")
            
            # Retirer les crochets du début et de la fin
            variants_existants=${variants_existants:1:${#variants_existants}-2}
            
            # Construire le nouveau tableau JSON
            local variants_json="["
            if [ ! -z "$variants_existants" ]; then
                variants_json+="$variants_existants"
                if [ ${#variants[@]} -gt 0 ]; then
                    variants_json+=","
                fi
            fi
            
            # Ajouter les nouveaux variants
            for i in "${!variants[@]}"; do
                if [ $i -gt 0 ]; then
                    variants_json+=","
                fi
                variants_json+="${variants[$i]}"
            done
            variants_json+="]"
            
            # Mettre à jour les variants dans la base de données
            executer_sql "UPDATE corner_products SET variants = '$variants_json'::jsonb WHERE id = $produit_id;"
            
            # Ajouter les nouveaux variants dans la table corner_product_variants
            for variant in "${variants[@]}"; do
                executer_sql "
                    INSERT INTO corner_product_variants (
                        corner_product_id,
                        taille,
                        couleur,
                        stock,
                        price,
                        product_name,
                        store_reference,
                        category_id,
                        brand_id,
                        active
                    )
                    SELECT 
                        $produit_id,
                        ($variant->>'size')::text,
                        ($variant->>'color')::text,
                        ($variant->>'stock')::integer,
                        p.price,
                        p.name,
                        p.store_reference,
                        p.category_id,
                        p.brand_id,
                        p.active
                    FROM corner_products p
                    WHERE p.id = $produit_id;
                "
            done
            ;;
            
        2)
            # Supprimer tous les variants existants
            executer_sql "DELETE FROM corner_product_variants WHERE corner_product_id = $produit_id;"
            
            # Ajouter de nouveaux variants
            while [[ "$continue_adding" == "y" ]]; do
                echo -e "\n${GREEN}Nouveau variant :${RESET}"
                
                read -p "Couleur: " color
                read -p "Taille: " size
                read -p "Stock: " stock
                
                # Validation du stock
                if ! [[ "$stock" =~ ^[0-9]+$ ]]; then
                    echo -e "${RED}Le stock doit être un nombre entier${RESET}"
                    continue
                fi
                
                # Ajouter le variant au tableau
                variants+=("{\"color\": \"$color\", \"size\": \"$size\", \"stock\": $stock}")
                
                read -p "Ajouter un autre variant? (y/n): " continue_adding
            done
            
            # Construire le tableau JSON
            local variants_json="["
            for i in "${!variants[@]}"; do
                if [ $i -gt 0 ]; then
                    variants_json+=","
                fi
                variants_json+="${variants[$i]}"
            done
            variants_json+="]"
            
            # Mettre à jour les variants dans la base de données
            executer_sql "UPDATE corner_products SET variants = '$variants_json'::jsonb WHERE id = $produit_id;"
            
            # Ajouter les nouveaux variants dans la table corner_product_variants
            for variant in "${variants[@]}"; do
                executer_sql "
                    INSERT INTO corner_product_variants (
                        corner_product_id,
                        taille,
                        couleur,
                        stock,
                        price,
                        product_name,
                        store_reference,
                        category_id,
                        brand_id,
                        active
                    )
                    SELECT 
                        $produit_id,
                        ($variant->>'size')::text,
                        ($variant->>'color')::text,
                        ($variant->>'stock')::integer,
                        p.price,
                        p.name,
                        p.store_reference,
                        p.category_id,
                        p.brand_id,
                        p.active
                    FROM corner_products p
                    WHERE p.id = $produit_id;
                "
            done
            ;;
    esac
}

# Fonction pour mettre à jour un produit
function mettre_a_jour_produit() {
    afficher_entete
    
    # Afficher la liste des produits
    echo -e "${YELLOW}Liste des produits The Corner :${RESET}"
    executer_sql "SELECT id, name, store_reference, price FROM corner_products WHERE store_type = 'cpcompany' ORDER BY id;"
    
    # Sélectionner le produit à mettre à jour
    read -p "ID du produit à mettre à jour: " product_id
    
    # Vérifier si le produit existe
    local product_exists=$(executer_sql "SELECT COUNT(*) FROM corner_products WHERE id = $product_id AND store_type = 'cpcompany';")
    if [[ $(echo "$product_exists" | tail -n 1) -eq 0 ]]; then
        echo -e "${RED}Produit non trouvé${RESET}"
        return 1
    fi
    
    # Afficher les informations actuelles du produit
    echo -e "\n${YELLOW}Informations actuelles :${RESET}"
    executer_sql "SELECT name, description, price, category_id, brand, sku, store_reference FROM corner_products WHERE id = $product_id;"
    
    # Demander quels champs mettre à jour
    echo -e "\n${GREEN}Quels champs souhaitez-vous mettre à jour ?${RESET}"
    echo "1) Nom"
    echo "2) Description"
    echo "3) Prix"
    echo "4) Catégorie"
    echo "5) Marque"
    echo "6) SKU"
    echo "7) Référence"
    echo "8) Variants"
    echo "9) Tout"
    echo "0) Annuler"
    
    read -p "Votre choix (séparés par des espaces pour plusieurs champs): " choices
    
    if [[ $choices == *"0"* ]]; then
        echo -e "${YELLOW}Mise à jour annulée${RESET}"
        return 0
    fi
    
    local update_query="UPDATE corner_products SET"
    local first=true
    
    if [[ $choices == *"9"* ]] || [[ $choices == *"1"* ]]; then
        read -p "Nouveau nom: " name
        update_query+=" name = '$name'"
        first=false
    fi
    
    if [[ $choices == *"9"* ]] || [[ $choices == *"2"* ]]; then
        read -p "Nouvelle description: " description
        if ! $first; then update_query+=","; fi
        update_query+=" description = '$description'"
        first=false
    fi
    
    if [[ $choices == *"9"* ]] || [[ $choices == *"3"* ]]; then
        read -p "Nouveau prix: " price
        while ! [[ "$price" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]]; do
            echo -e "${RED}Le prix doit être un nombre (ex: 99.99)${RESET}"
            read -p "Nouveau prix: " price
        done
        if ! $first; then update_query+=","; fi
        update_query+=" price = $price"
        first=false
        
        # Mettre à jour le prix dans la table variants
        executer_sql "
            UPDATE corner_product_variants 
            SET price = $price 
            WHERE corner_product_id = $product_id;
        "
    fi
    
    if [[ $choices == *"9"* ]] || [[ $choices == *"4"* ]]; then
        read -p "Nouvel ID de catégorie: " category_id
        if ! $first; then update_query+=","; fi
        update_query+=" category_id = $category_id"
        first=false
    fi
    
    if [[ $choices == *"9"* ]] || [[ $choices == *"5"* ]]; then
        read -p "Nouvelle marque: " brand
        if ! $first; then update_query+=","; fi
        update_query+=" brand = '$brand'"
        first=false
    fi
    
    if [[ $choices == *"9"* ]] || [[ $choices == *"6"* ]]; then
        read -p "Nouveau SKU: " sku
        if ! $first; then update_query+=","; fi
        update_query+=" sku = '$sku'"
        first=false
    fi
    
    if [[ $choices == *"9"* ]] || [[ $choices == *"7"* ]]; then
        read -p "Nouvelle référence: " reference
        if ! $first; then update_query+=","; fi
        update_query+=" store_reference = '$reference'"
        first=false
    fi
    
    # Exécuter la mise à jour si des champs ont été modifiés
    if ! $first; then
        update_query+=" WHERE id = $product_id;"
        executer_sql "$update_query"
        echo -e "${GREEN}Produit mis à jour avec succès${RESET}"
    fi
    
    # Mettre à jour les variants si demandé
    if [[ $choices == *"9"* ]] || [[ $choices == *"8"* ]]; then
        mettre_a_jour_variants "$product_id"
    fi
}

# Point d'entrée du script
while true; do
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== MENU PRINCIPAL ===${RESET}"
    echo -e "${CYAN}1. Mettre à jour un produit${RESET}"
    echo -e "${CYAN}0. Quitter${RESET}"
    
    read -p "Votre choix (0-1): " choix
    
    case $choix in
        0)
            echo -e "${GREEN}Au revoir!${RESET}"
            exit 0
            ;;
        1)
            mettre_a_jour_produit
            read -p "Appuyez sur Entrée pour continuer..."
            ;;
        *)
            echo -e "${RED}Choix invalide.${RESET}"
            read -p "Appuyez sur Entrée pour continuer..."
            ;;
    esac
done 