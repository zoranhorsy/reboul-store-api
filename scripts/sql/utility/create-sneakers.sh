#!/bin/bash
# Script pour créer des sneakers en masse avec leurs variantes

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
    echo -e "${MAGENTA}${BOLD}            CRÉATION DE SNEAKERS               ${RESET}"
    echo -e "${MAGENTA}======================================================${RESET}"
    echo ""
}

# Fonction pour exécuter une requête SQL
function executer_sql() {
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$1" 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' | grep -v '^INSERT' | grep -v '^UPDATE' | grep -v '^DELETE' | grep -v '^CREATE' | grep -v '^ALTER' | grep -v '^DROP'
}

# Fonction pour vérifier si un sneaker existe déjà
function sneaker_existe() {
    local ref="$1"
    local ref_escape=$(echo "$ref" | sed "s/'/''/g")
    local count=$(executer_sql "SELECT COUNT(*) FROM sneakers_products WHERE store_reference = '$ref_escape'")
    
    if [ "$count" -gt "0" ]; then
        return 0 # True
    else
        return 1 # False
    fi
}

# Fonction pour afficher les catégories disponibles
function afficher_categories() {
    echo -e "\n${CYAN}${BOLD}=== CATÉGORIES DISPONIBLES ===${RESET}"
    local categories=$(executer_sql "SELECT id, name FROM categories ORDER BY name;")
    echo "$categories"
    echo ""
}

# Fonction pour afficher les marques disponibles
function afficher_marques() {
    echo -e "\n${CYAN}${BOLD}=== MARQUES DISPONIBLES ===${RESET}"
    local marques=$(executer_sql "SELECT id, name FROM brands ORDER BY name;")
    echo "$marques"
    echo ""
}

# Fonction pour créer un sneaker
function creer_sneaker() {
    echo -e "\n${YELLOW}${BOLD}=== NOUVEAU SNEAKER ===${RESET}"
    
    # Demander la référence
    read -p "Référence produit (store_reference): " store_reference
    
    if [ -z "$store_reference" ]; then
        echo -e "${RED}Erreur: La référence est obligatoire.${RESET}"
        return 1
    fi
    
    # Vérifier si le sneaker existe déjà
    if sneaker_existe "$store_reference"; then
        echo -e "${RED}Erreur: Un sneaker avec cette référence existe déjà.${RESET}"
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
    
    read -p "Ancien prix (optionnel): " old_price
    if [ -z "$old_price" ]; then
        old_price="NULL"
    else
        old_price="'$old_price'"
    fi
    
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
    
    # Demander si le produit est en vedette
    echo -e "\n${CYAN}Options supplémentaires:${RESET}"
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
    
    # Insérer le sneaker
    echo -e "\n${YELLOW}Insertion du sneaker dans la base de données...${RESET}"
    
    local query="
        INSERT INTO sneakers_products (
            name, description, price, old_price, category_id, brand_id, brand,
            image_url, sku, store_reference, material, weight, dimensions,
            featured, new, active
        ) VALUES (
            '$name_escape', '$description_escape', $price, $old_price, $category_id, $brand_id, $brand,
            $image_url, $sku, '$store_reference_escape', $material, $weight, $dimensions,
            $featured, $new, true
        ) RETURNING id;
    "
    
    # Utiliser directement psql pour récupérer l'ID proprement
    export PGPASSWORD=$DB_PASSWORD
    local sneaker_id=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$query" 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' | grep -v '^INSERT' | grep -v '^UPDATE' | grep -v '^DELETE' | grep -v '^CREATE' | grep -v '^ALTER' | grep -v '^DROP')
    
    if [ -n "$sneaker_id" ]; then
        echo -e "${GREEN}Sneaker créé avec succès! ID: $sneaker_id${RESET}" >&2
        echo "$sneaker_id"
        return 0
    else
        echo -e "${RED}Erreur lors de la création du sneaker.${RESET}" >&2
        return 1
    fi
}

# Fonction pour ajouter des variantes à un sneaker
function ajouter_variantes() {
    local sneaker_id="$1"
    
    echo -e "${BLUE}DEBUG: sneaker_id reçu = '$sneaker_id'${RESET}"
    
    if [ -z "$sneaker_id" ]; then
        echo -e "${RED}Erreur: ID du sneaker manquant${RESET}"
        return 1
    fi
    
    echo -e "\n${YELLOW}${BOLD}=== AJOUTER DES VARIANTS ===${RESET}"
    echo -e "${CYAN}1. Oui, ajouter des variants${RESET}"
    echo -e "${CYAN}2. Non, passer au produit suivant${RESET}"
    
    read -p "Votre choix (1-2): " choix_variants
    
    if [ "$choix_variants" -ne 1 ]; then
        # Mettre à jour le champ variants à [] si aucun variant
        executer_sql "UPDATE sneakers_products SET variants = '[]'::jsonb WHERE id = $sneaker_id;" > /dev/null 2>&1
        return 0
    fi
    
    local continuer=true
    local compteur=0
    local variants_json="[]"
    
    while $continuer; do
        echo -e "\n${CYAN}=== Variant #$((compteur+1)) ===${RESET}"
        
        # Obtenir les détails du variant
        read -p "Taille (ex: EU 42): " taille
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
        
        # Insérer la variante dans la table sneakers_variants
        echo -e "\n${YELLOW}Insertion de la variante...${RESET}"
        
        local query="
            INSERT INTO sneakers_variants (
                sneakers_product_id, taille, couleur, stock, product_name,
                store_reference, category_id, brand_id, price, active
            ) VALUES (
                $sneaker_id, '$taille_escape', '$couleur_escape', $stock, 
                (SELECT name FROM sneakers_products WHERE id = $sneaker_id),
                (SELECT store_reference FROM sneakers_products WHERE id = $sneaker_id),
                (SELECT category_id FROM sneakers_products WHERE id = $sneaker_id),
                (SELECT brand_id FROM sneakers_products WHERE id = $sneaker_id),
                (SELECT price FROM sneakers_products WHERE id = $sneaker_id),
                true
            );
        "
        
        executer_sql "$query" > /dev/null 2>&1
        
        # Ajouter au tableau JSON (format standard sans price)
        local nouveau_variant="{\"size\": \"$taille\", \"color\": \"$couleur\", \"stock\": $stock}"
        if [ $compteur -eq 0 ]; then
            variants_json="[$nouveau_variant]"
        else
            variants_json=$(echo "$variants_json" | jq ". + [$nouveau_variant]")
        fi
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}Variante ajoutée avec succès!${RESET}"
            compteur=$((compteur+1))
        else
            echo -e "${RED}Erreur lors de l'ajout de la variante.${RESET}"
        fi
        
        # Demander si l'utilisateur veut ajouter un autre variant
        echo -e "\n${CYAN}Voulez-vous ajouter une autre variante pour ce sneaker? (o/n): ${RESET}"
        read -p "" ajouter_autre
        
        if [[ "$ajouter_autre" != "o"* ]]; then
            continuer=false
        fi
    done
    
    # Mettre à jour le champ variants du produit
    if [ $compteur -gt 0 ]; then
        # Échapper pour SQL
        variants_json_escaped=$(echo "$variants_json" | sed "s/'/''/g")
        echo -e "${BLUE}Mise à jour du champ variants avec: $variants_json${RESET}"
        echo -e "${BLUE}ID du sneaker: $sneaker_id${RESET}"
        
        # Mise à jour plus robuste - tester directement
        local update_query="UPDATE sneakers_products SET variants = '$variants_json_escaped'::jsonb WHERE id = $sneaker_id;"
        echo -e "${YELLOW}Exécution de la requête: $update_query${RESET}"
        
        # Exécuter sans redirection pour voir les erreurs
        export PGPASSWORD=$DB_PASSWORD
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$update_query"
        
        # Vérifier que la mise à jour a fonctionné
        local variants_check=$(executer_sql "SELECT variants::text FROM sneakers_products WHERE id = $sneaker_id;")
        if [ -n "$variants_check" ]; then
            echo -e "${BLUE}Variants enregistrés dans la base: $variants_check${RESET}"
        else
            echo -e "${RED}Erreur: Impossible de vérifier les variants enregistrés${RESET}"
        fi
    else
        echo -e "${BLUE}Aucun variant ajouté, mise à jour du champ variants à []${RESET}"
        executer_sql "UPDATE sneakers_products SET variants = '[]'::jsonb WHERE id = $sneaker_id;" > /dev/null 2>&1
    fi
    
    echo -e "${GREEN}Total: $compteur variante(s) ajoutée(s) pour ce sneaker.${RESET}"
}

# Fonction pour synchroniser les variants JSONB vers la table sneakers_variants
function synchroniser_variants() {
    echo -e "\n${YELLOW}${BOLD}=== SYNCHRONISATION DES VARIANTS ===${RESET}"
    echo -e "${BLUE}Analyse de la table sneakers_products...${RESET}"
    
    # Compter le nombre de produits avec des variants JSONB
    local nombre_produits=$(executer_sql "
        SELECT COUNT(*) FROM sneakers_products 
        WHERE variants IS NOT NULL 
        AND variants != '[]'::jsonb 
        AND variants != 'null'::jsonb;
    ")
    
    echo -e "${BLUE}Produits avec variants JSONB trouvés: $nombre_produits${RESET}"
    
    if [ "$nombre_produits" -eq "0" ]; then
        echo -e "${YELLOW}Aucun produit avec variants JSONB trouvé.${RESET}"
        return 0
    fi
    
    # Vider la table sneakers_variants
    echo -e "${YELLOW}Vidage de la table sneakers_variants...${RESET}"
    executer_sql "TRUNCATE TABLE sneakers_variants RESTART IDENTITY CASCADE;"
    
    # Insérer les variants depuis le champ JSONB
    echo -e "${YELLOW}Insertion des variants dans la table...${RESET}"
    
    executer_sql "
        INSERT INTO sneakers_variants (
            sneakers_product_id,
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
        FROM sneakers_products p,
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
    local nombre_variants=$(executer_sql "SELECT COUNT(*) FROM sneakers_variants;")
    echo -e "${GREEN}Synchronisation terminée : $nombre_variants variants copiés du champ JSONB vers la table.${RESET}"
}

# Fonction pour afficher le menu principal
function afficher_menu() {
    echo -e "\n${CYAN}${BOLD}=== MENU PRINCIPAL ===${RESET}"
    echo -e "${CYAN}1. Ajouter des sneakers en mode interactif${RESET}"
    echo -e "${CYAN}2. Synchroniser les variants JSONB vers la table sneakers_variants${RESET}"
    echo -e "${CYAN}3. Quitter${RESET}"
    echo ""
}

# Fonction principale
function main() {
    afficher_entete
    
    local continuer=true
    
    while $continuer; do
        afficher_menu
        read -p "Votre choix (1-3): " choix
        
        case $choix in
            1)
                echo -e "\n${BLUE}Mode ajout interactif de sneakers${RESET}"
                echo -e "${BLUE}Vous pourrez ajouter plusieurs variantes par sneaker et plusieurs sneakers.${RESET}"
                echo ""
                
                local total_sneakers=0
                local ajouter_continuer=true
                
                while $ajouter_continuer; do
                    # Créer un nouveau sneaker
                    local sneaker_id=$(creer_sneaker)
                    local creer_result=$?
                    
                    echo -e "${BLUE}DEBUG: creer_result=$creer_result, sneaker_id=$sneaker_id${RESET}"
                    
                    if [ $creer_result -eq 0 ] && [ -n "$sneaker_id" ]; then
                        echo -e "${BLUE}DEBUG: Appel de ajouter_variantes avec sneaker_id=$sneaker_id${RESET}"
                        
                        # Ajouter des variantes
                        ajouter_variantes "$sneaker_id"
                        
                        total_sneakers=$((total_sneakers+1))
                    else
                        echo -e "${RED}Erreur: Impossible de créer le sneaker ou de récupérer son ID${RESET}"
                    fi
                    
                    # Demander si l'utilisateur veut ajouter un autre sneaker
                    echo -e "\n${CYAN}${BOLD}Voulez-vous ajouter un autre sneaker? (o/n): ${RESET}"
                    read -p "" ajouter_autre_sneaker
                    
                    if [[ "$ajouter_autre_sneaker" != "o"* ]]; then
                        ajouter_continuer=false
                    fi
                done
                
                echo -e "\n${GREEN}${BOLD}=== RÉSUMÉ AJOUT ===${RESET}"
                echo -e "${GREEN}Total de sneakers ajoutés: $total_sneakers${RESET}"
                ;;
            2)
                synchroniser_variants
                ;;
            3)
                echo -e "\n${GREEN}Au revoir!${RESET}"
                continuer=false
                ;;
            *)
                echo -e "${RED}Choix invalide. Veuillez choisir 1, 2 ou 3.${RESET}"
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