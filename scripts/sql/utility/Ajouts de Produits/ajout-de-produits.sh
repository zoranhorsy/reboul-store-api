#!/bin/bash
# Script pour ajouter des produits dans les différents magasins de reboul

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

# Variables globales pour le magasin sélectionné
SELECTED_STORE=""
SELECTED_TABLE=""
SELECTED_VARIANTS_TABLE=""

# Fonction pour effacer l'écran et afficher l'en-tête
function afficher_entete() {
    clear
    echo -e "${MAGENTA}======================================================${RESET}"
    echo -e "${MAGENTA}${BOLD}            AJOUT DE PRODUITS REBOUL           ${RESET}"
    echo -e "${MAGENTA}======================================================${RESET}"
    echo ""
}

# Fonction pour exécuter une requête SQL
function executer_sql() {
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$1" 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' | grep -v '^INSERT' | grep -v '^UPDATE' | grep -v '^DELETE' | grep -v '^CREATE' | grep -v '^ALTER' | grep -v '^DROP'
}

# Fonction pour afficher le menu de sélection du magasin
function afficher_menu_magasin() {
    echo -e "\n${CYAN}${BOLD}=== SÉLECTION DU MAGASIN ===${RESET}"
    echo -e "${CYAN}1. Products (Magasin principal)${RESET}"
    echo -e "${CYAN}2. Sneakers Products${RESET}"
    echo -e "${CYAN}3. Minots Products${RESET}"
    echo -e "${CYAN}4. Corner Products${RESET}"
    echo -e "${CYAN}5. Quitter${RESET}"
    echo ""
}

# Fonction pour sélectionner le magasin
function selectionner_magasin() {
    afficher_menu_magasin
    read -p "Votre choix (1-5): " choix_magasin
    
    case $choix_magasin in
        1)
            SELECTED_STORE="Products"
            SELECTED_TABLE="products"
            SELECTED_VARIANTS_TABLE="product_variants"
            ;;
        2)
            SELECTED_STORE="Sneakers Products"
            SELECTED_TABLE="sneakers_products"
            SELECTED_VARIANTS_TABLE="sneakers_variants"
            ;;
        3)
            SELECTED_STORE="Minots Products"
            SELECTED_TABLE="minots_products"
            SELECTED_VARIANTS_TABLE="minots_variants"
            ;;
        4)
            SELECTED_STORE="Corner Products"
            SELECTED_TABLE="corner_products"
            SELECTED_VARIANTS_TABLE="corner_product_variants"
            ;;
        5)
            echo -e "\n${GREEN}Au revoir!${RESET}"
            exit 0
            ;;
        *)
            echo -e "${RED}Choix invalide. Veuillez choisir 1, 2, 3, 4 ou 5.${RESET}"
            return 1
            ;;
    esac
    
    echo -e "${GREEN}Magasin sélectionné: $SELECTED_STORE${RESET}"
    return 0
}

# Fonction pour afficher les catégories disponibles
function afficher_categories() {
    echo -e "\n${CYAN}${BOLD}=== CATÉGORIES DISPONIBLES ===${RESET}" >&2
    local categories=$(executer_sql "SELECT id, name FROM categories ORDER BY name;")
    echo "$categories" >&2
    echo "" >&2
}

# Fonction pour afficher les marques disponibles
function afficher_marques() {
    echo -e "\n${CYAN}${BOLD}=== MARQUES DISPONIBLES ===${RESET}" >&2
    local marques=$(executer_sql "SELECT id, name FROM brands ORDER BY name;")
    echo "$marques" >&2
    echo "" >&2
}

# Fonction pour vérifier si un produit existe déjà
function produit_existe() {
    local ref="$1"
    local ref_escape=$(echo "$ref" | sed "s/'/''/g")
    local count=$(executer_sql "SELECT COUNT(*) FROM $SELECTED_TABLE WHERE store_reference = '$ref_escape'")
    
    if [ "$count" -gt "0" ]; then
        return 0 # True
    else
        return 1 # False
    fi
}

# Fonction pour ajouter un produit
function ajouter_produit() {
    
    # Demander la référence
    read -p "Référence produit (store_reference): " store_reference
    
    if [ -z "$store_reference" ]; then
        echo -e "${RED}Erreur: La référence est obligatoire.${RESET}"
        return 1
    fi
    
    # Vérifier si le produit existe déjà
    if produit_existe "$store_reference"; then
        echo -e "${RED}Erreur: Un produit avec cette référence existe déjà.${RESET}"
        read -p "Voulez-vous continuer quand même? (o/n): " continuer
        if [[ "$continuer" != "o"* ]]; then
            return 1
        fi
    fi
    
    # Demander les autres informations
    read -p "Nom du produit: " name
    read -p "Description (optionnel): " description
    read -p "Prix: " price
    
    # Vérifier que le prix est un nombre
    if ! [[ "$price" =~ ^[0-9]+\.?[0-9]*$ ]]; then
        echo -e "${RED}Erreur: Le prix doit être un nombre valide.${RESET}"
        return 1
    fi
    
    read -p "Détails (optionnel, séparés par des virgules): " details
    
    # Afficher les catégories et demander l'ID
    afficher_categories
    read -p "ID de la catégorie (optionnel): " category_id
    if [ -z "$category_id" ]; then
        category_id="NULL"
    fi
    
    # Afficher les marques et demander l'ID
    afficher_marques
    read -p "ID de la marque (optionnel): " brand_id
    if [ -z "$brand_id" ]; then
        brand_id="NULL"
    fi
    
    read -p "Nom de la marque (optionnel): " brand
    if [ -z "$brand" ]; then
        brand="NULL"
    else
        brand="'$brand'"
    fi
    
    read -p "URL de l'image principale (optionnel): " image_url
    if [ -z "$image_url" ]; then
        image_url="NULL"
    else
        image_url="'$image_url'"
    fi
    
    read -p "SKU (optionnel): " sku
    if [ -z "$sku" ]; then
        sku="NULL"
    else
        sku="'$sku'"
    fi
    
    read -p "Matériau (optionnel): " material
    if [ -z "$material" ]; then
        material="NULL"
    else
        material="'$material'"
    fi
    
    read -p "Poids en grammes (optionnel): " weight
    if [ -z "$weight" ]; then
        weight="NULL"
    fi
    
    read -p "Dimensions (optionnel): " dimensions
    if [ -z "$dimensions" ]; then
        dimensions="NULL"
    else
        dimensions="'$dimensions'"
    fi
    
    # Demander si le produit est en vedette et nouveau
    echo -e "\n${CYAN}Options supplémentaires:${RESET}" >&2
    read -p "Produit en vedette? (o/n): " featured
    if [[ "$featured" == "o"* ]]; then
        featured="true"
    else
        featured="false"
    fi
    
    read -p "Produit nouveau? (o/n): " new
    if [[ "$new" == "o"* ]]; then
        new="true"
    else
        new="false"
    fi
    
    # Échapper les caractères spéciaux
    name_escape=$(echo "$name" | sed "s/'/''/g")
    description_escape=$(echo "$description" | sed "s/'/''/g")
    store_reference_escape=$(echo "$store_reference" | sed "s/'/''/g")
    
    # Préparer les détails
    if [ -n "$details" ]; then
        details_array="ARRAY[$(echo "$details" | sed "s/,/','/g" | sed "s/^/'/;s/$/'/")]"
    else
        details_array="NULL"
    fi
    
    # Insérer le produit selon la table
    echo -e "\n${YELLOW}Insertion du produit dans la base de données...${RESET}" >&2
    
    local query=""
    case $SELECTED_TABLE in
        "products")
            query="
                INSERT INTO products (
                    name, description, price, category_id, brand_id, brand,
                    image_url, sku, store_reference, material, weight, dimensions,
                    featured, new, active, details
                ) VALUES (
                    '$name_escape', '$description_escape', $price, $category_id, $brand_id, $brand,
                    $image_url, $sku, '$store_reference_escape', $material, $weight, $dimensions,
                    $featured, $new, true, $details_array
                ) RETURNING id;
            "
            ;;
        "sneakers_products")
            query="
                INSERT INTO sneakers_products (
                    name, description, price, category_id, brand_id, brand,
                    image_url, sku, store_reference, material, weight, dimensions,
                    featured, new, active, details
                ) VALUES (
                    '$name_escape', '$description_escape', $price, $category_id, $brand_id, $brand,
                    $image_url, $sku, '$store_reference_escape', $material, $weight, $dimensions,
                    $featured, $new, true, $details_array
                ) RETURNING id;
            "
            ;;
        "minots_products")
            query="
                INSERT INTO minots_products (
                    name, description, price, category_id, brand_id, brand,
                    image_url, sku, store_reference, material, weight, dimensions,
                    featured, new, active, details
                ) VALUES (
                    '$name_escape', '$description_escape', $price, $category_id, $brand_id, $brand,
                    $image_url, $sku, '$store_reference_escape', $material, $weight, $dimensions,
                    $featured, $new, true, $details_array
                ) RETURNING id;
            "
            ;;
        "corner_products")
            query="
                INSERT INTO corner_products (
                    name, description, price, category_id, brand_id, brand,
                    image_url, sku, store_reference, material, weight, dimensions,
                    featured, new, active, details
                ) VALUES (
                    '$name_escape', '$description_escape', $price, $category_id, $brand_id, $brand,
                    $image_url, $sku, '$store_reference_escape', $material, $weight, $dimensions,
                    $featured, $new, true, $details_array
                ) RETURNING id;
            "
            ;;
    esac
    
    # Utiliser directement psql pour récupérer l'ID proprement
    export PGPASSWORD=$DB_PASSWORD
    local product_id=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$query" 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -E '^[0-9]+$')
    
    if [ -n "$product_id" ]; then
        echo -e "${GREEN}Produit créé avec succès! ID: $product_id${RESET}" >&2
        echo "$product_id|$store_reference"
        return 0
    else
        echo -e "${RED}Erreur lors de la création du produit.${RESET}" >&2
        return 1
    fi
}

# Fonction pour ajouter des variants à un produit
function ajouter_variants() {
    local product_id="$1"
    local store_reference="$2"
    
    if [ -z "$product_id" ]; then
        echo -e "${RED}Erreur: ID du produit manquant${RESET}"
        return 1
    fi
    
    echo -e "\n${YELLOW}${BOLD}=== AJOUTER DES VARIANTS ===${RESET}"
    echo -e "${CYAN}1. Oui, ajouter des variants${RESET}"
    echo -e "${CYAN}2. Non, passer au produit suivant${RESET}"
    
    read -p "Votre choix (1-2): " choix_variants
    
    if [ "$choix_variants" -ne 1 ]; then
        # Mettre à jour le champ variants à [] si aucun variant
        executer_sql "UPDATE $SELECTED_TABLE SET variants = '[]'::jsonb WHERE id = $product_id;" > /dev/null 2>&1
        return 0
    fi
    
    local continuer=true
    local compteur=0
    local variants_json="[]"
    
    while $continuer; do
        echo -e "\n${CYAN}=== Variant #$((compteur+1)) ===${RESET}"
        
        # Obtenir les détails du variant
        read -p "Taille (ex: EU 42, S, M, L): " taille
        read -p "Couleur: " couleur
        read -p "Stock: " stock
        
        # Vérifier que le stock est un nombre
        if ! [[ "$stock" =~ ^[0-9]+$ ]]; then
            echo -e "${RED}Erreur: Le stock doit être un nombre entier.${RESET}"
            read -p "Voulez-vous réessayer? (o/n): " retry
            if [[ "$retry" == "o"* ]]; then
                continue
            else
                break
            fi
        fi
        
        # Échapper les caractères spéciaux
        taille_escape=$(echo "$taille" | sed "s/'/''/g")
        couleur_escape=$(echo "$couleur" | sed "s/'/''/g")
        
        # Pas d'insertion dans la table variants, on va juste construire le JSON
        echo -e "\n${YELLOW}Ajout de la variante au JSON...${RESET}" >&2
        
        # Construire le variant JSON avec jq (plus sûr)
        local nouveau_variant=$(jq -n --arg size "$taille" --arg color "$couleur" --argjson stock "$stock" '{"size": $size, "color": $color, "stock": $stock}')
        
        if [ $? -eq 0 ]; then
            # Ajouter au tableau JSON
            if [ $compteur -eq 0 ]; then
                variants_json="[$nouveau_variant]"
            else
                variants_json=$(echo "$variants_json" | jq ". + [$nouveau_variant]")
            fi
            
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}Variante ajoutée avec succès!${RESET}" >&2
                compteur=$((compteur+1))
            else
                echo -e "${RED}Erreur lors de la construction du JSON.${RESET}" >&2
            fi
        else
            echo -e "${RED}Erreur lors de la création du variant JSON.${RESET}" >&2
        fi
        
        # Demander si l'utilisateur veut ajouter un autre variant
        echo -e "\n${CYAN}Voulez-vous ajouter une autre variante pour ce produit? (o/n): ${RESET}"
        read -p "" ajouter_autre
        
        if [[ "$ajouter_autre" != "o"* ]]; then
            continuer=false
        fi
    done
    
    # Mettre à jour le champ variants du produit
    if [ $compteur -gt 0 ]; then
        
        # UTILISER L'ID DU PRODUIT (plus fiable) - COMPACTER LE JSON
        export PGPASSWORD=$DB_PASSWORD
        local compact_json=$(echo "$variants_json" | jq -c .)
        local update_query="UPDATE $SELECTED_TABLE SET variants = '$compact_json'::jsonb WHERE id = $product_id;"
        local update_result=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$update_query" 2>&1)
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Champ variants mis à jour avec succès!${RESET}" >&2
        else
            echo -e "${RED}Erreur lors de la mise à jour du champ variants: $update_result${RESET}" >&2
        fi
        
        # Vérifier que la mise à jour a fonctionné
        export PGPASSWORD=$DB_PASSWORD
        local check_query="SELECT variants::text FROM $SELECTED_TABLE WHERE id = $product_id;"
        local variants_check=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$check_query" 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        
        if [ -n "$variants_check" ] && [ "$variants_check" != "" ]; then
            echo -e "${BLUE}Variants enregistrés dans la base: $variants_check${RESET}" >&2
        else
            echo -e "${YELLOW}Champ variants vide ou NULL${RESET}" >&2
        fi
    else
        echo -e "${BLUE}Aucun variant ajouté, mise à jour du champ variants à []${RESET}" >&2
        export PGPASSWORD=$DB_PASSWORD
        local empty_query=$(printf "UPDATE %s SET variants = '[]'::jsonb WHERE store_reference = '%s';" "$SELECTED_TABLE" "$store_reference")
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$empty_query" > /dev/null 2>&1
    fi
    
    echo -e "${GREEN}Total: $compteur variante(s) ajoutée(s) pour ce produit.${RESET}" >&2
}

# Fonction pour synchroniser les variants JSONB vers la table variants
function synchroniser_variants() {
    echo -e "\n${YELLOW}${BOLD}=== SYNCHRONISATION DES VARIANTS ===${RESET}"
    echo -e "${BLUE}Analyse de la table $SELECTED_TABLE...${RESET}"
    
    # Compter le nombre de produits avec des variants JSONB
    local nombre_produits=$(executer_sql "
        SELECT COUNT(*) FROM $SELECTED_TABLE 
        WHERE variants IS NOT NULL 
        AND variants != '[]'::jsonb 
        AND variants != 'null'::jsonb;
    ")
    
    echo -e "${BLUE}Produits avec variants JSONB trouvés: $nombre_produits${RESET}"
    
    if [ "$nombre_produits" -eq "0" ]; then
        echo -e "${YELLOW}Aucun produit avec variants JSONB trouvé.${RESET}"
        return 0
    fi
    
    # Vider la table variants
    echo -e "${YELLOW}Vidage de la table $SELECTED_VARIANTS_TABLE...${RESET}"
    executer_sql "TRUNCATE TABLE $SELECTED_VARIANTS_TABLE RESTART IDENTITY CASCADE;"
    
    # Insérer les variants depuis le champ JSONB
    echo -e "${YELLOW}Insertion des variants dans la table...${RESET}"
    
    # Déterminer le nom de la colonne ID selon la table
    local id_column=""
    case $SELECTED_TABLE in
        "products")
            id_column="products_id"
            ;;
        "sneakers_products")
            id_column="sneakers_product_id"
            ;;
        "minots_products")
            id_column="minots_product_id"
            ;;
        "corner_products")
            id_column="corner_product_id"
            ;;
    esac
    
    executer_sql "
        INSERT INTO $SELECTED_VARIANTS_TABLE (
            $id_column,
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
            p.name,
            p.store_reference,
            p.category_id,
            p.brand_id,
            p.price,
            p.active
        FROM $SELECTED_TABLE p,
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
    " > /dev/null 2>&1
    
    # Vérifier le nombre de variants insérés
    local nombre_variants=$(executer_sql "SELECT COUNT(*) FROM $SELECTED_VARIANTS_TABLE;")
    echo -e "${GREEN}Synchronisation terminée : $nombre_variants variants copiés du champ JSONB vers la table.${RESET}"
}

# Fonction pour afficher le menu principal
function afficher_menu_principal() {
    echo -e "\n${CYAN}${BOLD}=== MENU PRINCIPAL ===${RESET}"
    echo -e "${CYAN}Magasin actuel: $SELECTED_STORE${RESET}"
    echo -e "${CYAN}1. Ajouter des produits en mode interactif${RESET}"
    echo -e "${CYAN}2. Synchroniser les variants JSONB vers la table $SELECTED_VARIANTS_TABLE${RESET}"
    echo -e "${CYAN}3. Changer de magasin${RESET}"
    echo -e "${CYAN}4. Quitter${RESET}"
    echo ""
}

# Fonction principale
function main() {
    afficher_entete
    
    # Sélectionner le magasin initial
    while ! selectionner_magasin; do
        echo -e "${YELLOW}Appuyez sur Entrée pour réessayer...${RESET}"
        read
        afficher_entete
    done
    
    local continuer=true
    
    while $continuer; do
        afficher_entete
        afficher_menu_principal
        read -p "Votre choix (1-4): " choix
        
        case $choix in
            1)
                echo -e "\n${BLUE}Mode ajout interactif de produits${RESET}"
                echo -e "${BLUE}Vous pourrez ajouter plusieurs variantes par produit et plusieurs produits.${RESET}"
                echo ""
                
                local total_produits=0
                local ajouter_continuer=true
                
                while $ajouter_continuer; do
                    # Créer un nouveau produit
                    local result=$(ajouter_produit)
                    local creer_result=$?
                    
                    if [ $creer_result -eq 0 ] && [ -n "$result" ]; then
                        # Extraire l'ID et la store_reference
                        local product_id=$(echo "$result" | cut -d'|' -f1)
                        local store_reference=$(echo "$result" | cut -d'|' -f2)
                        
                        # Ajouter des variantes
                        ajouter_variants "$product_id" "$store_reference"
                        
                        total_produits=$((total_produits+1))
                    else
                        echo -e "${RED}Erreur: Impossible de créer le produit ou de récupérer son ID${RESET}"
                    fi
                    
                    # Demander si l'utilisateur veut ajouter un autre produit
                    echo -e "\n${CYAN}${BOLD}Voulez-vous ajouter un autre produit? (o/n): ${RESET}"
                    read -p "" ajouter_autre_produit
                    
                    if [[ "$ajouter_autre_produit" != "o"* ]]; then
                        ajouter_continuer=false
                    fi
                done
                
                echo -e "\n${GREEN}${BOLD}=== RÉSUMÉ AJOUT ===${RESET}"
                echo -e "${GREEN}Total de produits ajoutés: $total_produits${RESET}"
                ;;
            2)
                synchroniser_variants
                ;;
            3)
                # Changer de magasin
                while ! selectionner_magasin; do
                    echo -e "${YELLOW}Appuyez sur Entrée pour réessayer...${RESET}"
                    read
                    afficher_entete
                done
                ;;
            4)
                echo -e "\n${GREEN}Au revoir!${RESET}"
                continuer=false
                ;;
            *)
                echo -e "${RED}Choix invalide. Veuillez choisir 1, 2, 3 ou 4.${RESET}"
                ;;
        esac
        
        if [ "$continuer" = true ]; then
            echo -e "\n${CYAN}Appuyez sur Entrée pour continuer...${RESET}"
            read
            afficher_entete
        fi
    done
}

# Exécuter le script principal
main
