#!/bin/bash
# Script pour créer un nouveau produit en remplissant tous les champs

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
    echo -e "${MAGENTA}${BOLD}            CRÉATION DE PRODUIT                ${RESET}"
    echo -e "${MAGENTA}======================================================${RESET}"
    echo ""
}

# Fonction pour exécuter une requête SQL
function executer_sql() {
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Fonction pour vérifier si un produit existe déjà
function produit_existe() {
    local ref="$1"
    local ref_escape=$(echo "$ref" | sed "s/'/''/g")
    local count=$(executer_sql "SELECT COUNT(*) FROM products WHERE store_reference = '$ref_escape'")
    
    if [ "$count" -gt "0" ]; then
        return 0 # True
    else
        return 1 # False
    fi
}

# Fonction pour ajouter un tableau JSON vide pour les variants
function ajouter_variants() {
    local produit_id="$1"
    
    echo -e "\n${YELLOW}${BOLD}=== AJOUTER DES VARIANTS ? ===${RESET}"
    echo -e "${CYAN}1. Oui, ajouter des variants${RESET}"
    echo -e "${CYAN}2. Non, laisser les variants vides${RESET}"
    
    read -p "Votre choix (1-2): " choix_variants
    
    if [ "$choix_variants" -eq 1 ]; then
        local variants="[]"
        local continuer=true
        local compteur=0
        
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
                    if [ $compteur -eq 0 ]; then
                        variants="[]"
                        break
                    else
                        break
                    fi
                fi
            fi
            
            # Créer le nouveau variant
            local nouveau_variant="{\"size\": \"$taille\", \"color\": \"$couleur\", \"stock\": $stock}"
            
            # Ajouter le variant au tableau existant
            if [ "$compteur" -eq 0 ]; then
                variants="[$nouveau_variant]"
            else
                variants=$(echo "$variants" | jq ". + [$nouveau_variant]")
            fi
            
            compteur=$((compteur+1))
            
            # Demander si l'utilisateur veut ajouter un autre variant
            read -p "Voulez-vous ajouter un autre variant? (o/n): " reponse
            if [[ "$reponse" != "o"* ]]; then
                continuer=false
            fi
        done
        
        # Vérifier que le tableau de variants est bien formaté
        echo -e "${BLUE}Vérification du format des variants...${RESET}"
        echo -e "${BLUE}Variants avant insertion: $variants${RESET}"
        
        # Vérifier avec jq que c'est un JSON valide
        if ! echo "$variants" | jq . > /dev/null 2>&1; then
            echo -e "${RED}ERREUR: Les variants ne sont pas au format JSON valide.${RESET}"
            echo -e "${RED}Utilisation d'un tableau vide pour éviter les problèmes.${RESET}"
            variants="[]"
        fi
        
        # Échapper pour SQL
        local variants_escaped=$(echo "$variants" | sed "s/'/''/g")
        
        # Mettre à jour la base de données
        echo -e "${BLUE}Mise à jour des variants pour le produit $produit_id...${RESET}"
        executer_sql "UPDATE products SET variants = '$variants_escaped'::jsonb WHERE id = $produit_id" > /dev/null 2>&1
        
        # Vérifier si la mise à jour a réussi
        local variants_check=$(executer_sql "SELECT variants::text FROM products WHERE id = $produit_id")
        echo -e "${BLUE}Variants enregistrés: $variants_check${RESET}"
        
        # Vérifier que les variants sont bien au format JSONB dans la base
        local json_type=$(executer_sql "SELECT jsonb_typeof(variants) FROM products WHERE id = $produit_id")
        echo -e "${BLUE}Type de données JSON: $json_type${RESET}"
        
        if [[ "$json_type" != "array" ]]; then
            echo -e "${RED}AVERTISSEMENT: Les variants ne sont pas enregistrés comme un tableau JSON.${RESET}"
            echo -e "${RED}Tentative de correction...${RESET}"
            executer_sql "UPDATE products SET variants = '[]'::jsonb WHERE id = $produit_id" > /dev/null 2>&1
            executer_sql "UPDATE products SET variants = '$variants_escaped'::jsonb WHERE id = $produit_id" > /dev/null 2>&1
            
            # Vérifier à nouveau
            json_type=$(executer_sql "SELECT jsonb_typeof(variants) FROM products WHERE id = $produit_id")
            if [[ "$json_type" == "array" ]]; then
                echo -e "${GREEN}Correction réussie. Les variants sont maintenant bien formatés.${RESET}"
            else
                echo -e "${RED}Échec de la correction. Les variants restent mal formatés.${RESET}"
            fi
        fi
        
        echo -e "${GREEN}$compteur variant(s) ajouté(s) avec succès!${RESET}"
    else
        executer_sql "UPDATE products SET variants = '[]'::jsonb WHERE id = $produit_id" > /dev/null 2>&1
        echo -e "${BLUE}Aucun variant ajouté.${RESET}"
    fi
}

# Fonction pour vérifier que les produits ont bien été créés
function verifier_produits_crees() {
    local references=("$@")
    local total=${#references[@]}
    local produits_verifies=0
    local produits_manquants=0
    local produits_manquants_liste=()
    
    echo -e "\n${YELLOW}${BOLD}=== VÉRIFICATION FINALE DES PRODUITS CRÉÉS ===${RESET}"
    echo -e "${BLUE}Vérification que tous les produits sont bien dans la base de données...${RESET}"
    
    for ref in "${references[@]}"; do
        if produit_existe "$ref"; then
            produits_verifies=$((produits_verifies+1))
            echo -e "${GREEN}✓ Produit avec référence '$ref' bien présent dans la base de données.${RESET}"
        else
            produits_manquants=$((produits_manquants+1))
            produits_manquants_liste+=("$ref")
            echo -e "${RED}✗ Produit avec référence '$ref' INTROUVABLE dans la base de données!${RESET}"
        fi
    done
    
    echo -e "\n${YELLOW}${BOLD}=== RÉSULTAT DE LA VÉRIFICATION ===${RESET}"
    if [ $produits_manquants -eq 0 ]; then
        echo -e "${GREEN}Tous les produits ($produits_verifies/$total) ont été correctement créés dans la base de données.${RESET}"
    else
        echo -e "${RED}ATTENTION: $produits_manquants/$total produits n'ont pas été trouvés dans la base de données:${RESET}"
        for ref_manquante in "${produits_manquants_liste[@]}"; do
            echo -e "${RED}- $ref_manquante${RESET}"
        done
        echo -e "${YELLOW}Cela peut indiquer un problème lors de la création ou une erreur dans la base de données.${RESET}"
    fi
}

# Fonction pour synchroniser la table product_variants avec les données de variants dans products
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
    
    # Afficher quelques exemples de variants dans la table products pour diagnostic
    echo -e "${BLUE}Exemples de variants dans la table products (avant synchronisation):${RESET}"
    local exemples_avant=$(executer_sql "
        SELECT id, name, variants::text 
        FROM products 
        WHERE variants IS NOT NULL 
        AND variants != '[]'::jsonb 
        AND variants != 'null'::jsonb 
        LIMIT 3;
    ")
    if [[ -z "$exemples_avant" ]]; then
        echo -e "${RED}Aucun produit avec variants valides trouvé!${RESET}"
    else
        echo "$exemples_avant"
    fi
    
    # Compter le nombre de produits avec des variants
    local nombre_produits_avec_variants=$(executer_sql "
        SELECT COUNT(*) FROM products 
        WHERE variants IS NOT NULL 
        AND variants != '[]'::jsonb 
        AND variants != 'null'::jsonb;
    ")
    
    echo -e "${BLUE}Produits avec variants trouvés: $nombre_produits_avec_variants${RESET}"
    
    # Vider la table product_variants
    executer_sql "TRUNCATE TABLE product_variants;" > /dev/null 2>&1
    echo -e "${BLUE}Table product_variants vidée.${RESET}"
    
    # Vérifier le format JSON des variants
    echo -e "${BLUE}Vérification du format JSON des variants...${RESET}"
    local json_check=$(executer_sql "
        SELECT id, name, jsonb_typeof(variants) AS type
        FROM products
        WHERE variants IS NOT NULL
        AND variants != 'null'::jsonb
        LIMIT 5;
    ")
    echo "$json_check"
    
    # Re-remplir la table à partir des données JSON dans products.variants
    echo -e "${BLUE}Insertion des variants dans product_variants...${RESET}"
    
    # Ne pas rediriger la sortie pour voir les éventuelles erreurs
    local resultat=$(executer_sql "
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
        AND p.variants != 'null'::jsonb
        RETURNING products_id;
    ")
    
    echo -e "${BLUE}Résultat de l'insertion: $resultat${RESET}"
    
    # Vérifier le nombre de variants insérés
    local nombre_variants=$(executer_sql "SELECT COUNT(*) FROM product_variants;")
    
    echo -e "${GREEN}Table product_variants mise à jour avec $nombre_variants variant(s).${RESET}"
    
    # Afficher un échantillon des variants insérés
    if [[ "$nombre_variants" -gt "0" ]]; then
        echo -e "${BLUE}Échantillon des variants insérés:${RESET}"
        local sample=$(executer_sql "
            SELECT pv.products_id, p.name, pv.taille, pv.couleur, pv.stock
            FROM product_variants pv
            JOIN products p ON p.id = pv.products_id
            LIMIT 5;
        ")
        echo "$sample"
    fi
    
    # Si aucun variant n'a été inséré mais qu'il y a des produits avec variants, afficher un avertissement
    if [[ "$nombre_variants" -eq "0" && "$nombre_produits_avec_variants" -gt "0" ]]; then
        echo -e "${RED}AVERTISSEMENT: Aucun variant n'a été inséré malgré $nombre_produits_avec_variants produits avec variants.${RESET}"
        echo -e "${YELLOW}Cela peut indiquer un problème avec le format JSON des variants.${RESET}"
        
        # Afficher un exemple de format attendu
        echo -e "${BLUE}Format attendu pour les variants: [{ \"size\": \"EU 42\", \"color\": \"Noir\", \"stock\": 3 }]${RESET}"
        
        # Examiner plus en détail la structure des variants
        echo -e "${YELLOW}Examen détaillé des variants:${RESET}"
        local detail_check=$(executer_sql "
            SELECT id, name, 
            CASE 
                WHEN jsonb_typeof(variants) = 'array' THEN 'array'
                ELSE 'non-array: ' || jsonb_typeof(variants)
            END AS type,
            variants::text
            FROM products 
            WHERE variants IS NOT NULL
            AND variants != '[]'::jsonb
            LIMIT 5;
        ")
        echo "$detail_check"
        
        # Vérifier si les variants ont les clés requises
        echo -e "${YELLOW}Vérification des clés des variants:${RESET}"
        local key_check=$(executer_sql "
            SELECT p.id, p.name,
            json_array_length(p.variants::json) AS variant_count,
            EXISTS (
                SELECT 1 FROM jsonb_array_elements(p.variants) AS v
                WHERE v ? 'size' AND v ? 'color' AND v ? 'stock'
            ) AS has_required_keys
            FROM products p
            WHERE p.variants IS NOT NULL
            AND p.variants != '[]'::jsonb
            AND p.variants != 'null'::jsonb
            AND jsonb_typeof(p.variants) = 'array'
            LIMIT 5;
        ")
        echo "$key_check"
    fi
}

# Fonction principale pour créer un nouveau produit
function creer_produit() {
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== CRÉATION D'UN NOUVEAU PRODUIT ===${RESET}"
    echo -e "${BLUE}Connexion à la base de données Railway${RESET}"
    echo ""

    # Demander la référence du produit
    read -p "Entrez la référence du produit: " ref_produit

    if [ -z "$ref_produit" ]; then
        echo -e "${RED}Erreur: La référence du produit ne peut pas être vide.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi

    # Vérifier si le produit existe déjà
    if produit_existe "$ref_produit"; then
        echo -e "${RED}Erreur: Un produit avec la référence '$ref_produit' existe déjà.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi

    # Collecter les informations du produit
    echo -e "\n${CYAN}${BOLD}=== INFORMATIONS DE BASE ===${RESET}"
    read -p "Nom du produit: " nom
    read -p "Description: " description
    read -p "Prix: " prix
    read -p "Catégorie ID: " categorie_id
    read -p "Marque (texte): " marque
    read -p "Marque ID: " marque_id
    read -p "URL de l'image principale: " image_url
    read -p "SKU: " sku
    read -p "Type de magasin: " store_type
    
    echo -e "\n${CYAN}${BOLD}=== OPTIONS ===${RESET}"
    read -p "Produit en vedette (true/false): " featured
    read -p "Produit actif (true/false): " active
    read -p "Nouveau produit (true/false): " new
    
    # Vérifier que le prix est un nombre
    if ! [[ "$prix" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]]; then
        echo -e "${RED}Erreur: Le prix doit être un nombre (ex: 99.99).${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Préparer les valeurs pour SQL
    ref_escape=$(echo "$ref_produit" | sed "s/'/''/g")
    nom_escape=$(echo "$nom" | sed "s/'/''/g")
    description_escape=$(echo "$description" | sed "s/'/''/g")
    marque_escape=$(echo "$marque" | sed "s/'/''/g")
    image_url_escape=$(echo "$image_url" | sed "s/'/''/g")
    sku_escape=$(echo "$sku" | sed "s/'/''/g")
    store_type_escape=$(echo "$store_type" | sed "s/'/''/g")
    
    # Valider les booléens
    featured=$(echo "$featured" | tr '[:upper:]' '[:lower:]')
    active=$(echo "$active" | tr '[:upper:]' '[:lower:]')
    new=$(echo "$new" | tr '[:upper:]' '[:lower:]')
    
    if [[ "$featured" != "true" && "$featured" != "false" ]]; then
        featured="false"
    fi
    
    if [[ "$active" != "true" && "$active" != "false" ]]; then
        active="true"
    fi
    
    if [[ "$new" != "true" && "$new" != "false" ]]; then
        new="false"
    fi
    
    # Insérer le produit dans la base de données
    echo -e "\n${YELLOW}${BOLD}=== CRÉATION DU PRODUIT ===${RESET}"
    echo -e "${BLUE}Insertion des données dans la base...${RESET}"
    
    produit_id=$(executer_sql "INSERT INTO products 
        (name, description, price, category_id, brand, brand_id, image_url, images, tags, details, 
        store_type, store_reference, featured, active, new, sku) 
        VALUES 
        ('$nom_escape', '$description_escape', $prix, $categorie_id, '$marque_escape', $marque_id, 
        '$image_url_escape', '{}', '{}', '{}', 
        '$store_type_escape', '$ref_escape', $featured, $active, $new, '$sku_escape')
        RETURNING id")
    
    if [ -z "$produit_id" ]; then
        echo -e "${RED}Erreur lors de la création du produit.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    echo -e "${GREEN}Produit créé avec succès! ID: $produit_id${RESET}"
    
    # Ajouter les variants
    ajouter_variants "$produit_id"
    
    echo -e "\n${GREEN}${BOLD}=== PRODUIT COMPLET CRÉÉ AVEC SUCCÈS ===${RESET}"
    echo -e "${BLUE}ID: $produit_id${RESET}"
    echo -e "${BLUE}Référence: $ref_produit${RESET}"
    echo -e "${BLUE}Nom: $nom${RESET}"
    
    # Vérifier que le produit a bien été créé dans la base de données
    echo -e "\n${YELLOW}${BOLD}=== VÉRIFICATION FINALE ===${RESET}"
    if produit_existe "$ref_produit"; then
        echo -e "${GREEN}✓ Le produit a bien été créé et est présent dans la base de données.${RESET}"
    else
        echo -e "${RED}✗ ATTENTION: Le produit ne semble pas avoir été correctement créé dans la base de données!${RESET}"
        echo -e "${RED}  Vérifiez les logs pour plus de détails.${RESET}"
    fi
    
    # Synchroniser la table product_variants
    synchroniser_product_variants
    
    read -p "Appuyez sur Entrée pour continuer..."
    return 0
}

# Fonction pour créer rapidement plusieurs produits
function creer_produits_en_serie() {
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== CRÉATION RAPIDE DE PLUSIEURS PRODUITS ===${RESET}"
    echo -e "${BLUE}Cette fonction permet de créer plusieurs produits avec un modèle commun.${RESET}"
    echo -e "${BLUE}Vous allez d'abord définir un modèle de produit, puis ajouter plusieurs références.${RESET}"
    echo ""

    # Définir le modèle de produit
    echo -e "${CYAN}${BOLD}=== DÉFINITION DU MODÈLE DE PRODUIT ===${RESET}"
    
    # Collecter les informations communes
    read -p "Nom du produit (modèle commun): " nom
    read -p "Description: " description
    read -p "Prix: " prix
    read -p "Catégorie ID: " categorie_id
    read -p "Marque (texte): " marque
    read -p "Marque ID: " marque_id
    read -p "URL de l'image principale: " image_url
    read -p "Type de magasin: " store_type
    
    echo -e "\n${CYAN}${BOLD}=== OPTIONS COMMUNES ===${RESET}"
    read -p "Produit en vedette (true/false): " featured
    read -p "Produit actif (true/false): " active
    read -p "Nouveau produit (true/false): " new
    
    # Vérifier que le prix est un nombre
    if ! [[ "$prix" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]]; then
        echo -e "${RED}Erreur: Le prix doit être un nombre (ex: 99.99).${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Préparer les valeurs communes pour SQL
    nom_escape=$(echo "$nom" | sed "s/'/''/g")
    description_escape=$(echo "$description" | sed "s/'/''/g")
    marque_escape=$(echo "$marque" | sed "s/'/''/g")
    image_url_escape=$(echo "$image_url" | sed "s/'/''/g")
    store_type_escape=$(echo "$store_type" | sed "s/'/''/g")
    
    # Valider les booléens
    featured=$(echo "$featured" | tr '[:upper:]' '[:lower:]')
    active=$(echo "$active" | tr '[:upper:]' '[:lower:]')
    new=$(echo "$new" | tr '[:upper:]' '[:lower:]')
    
    if [[ "$featured" != "true" && "$featured" != "false" ]]; then
        featured="false"
    fi
    
    if [[ "$active" != "true" && "$active" != "false" ]]; then
        active="true"
    fi
    
    if [[ "$new" != "true" && "$new" != "false" ]]; then
        new="false"
    fi
    
    # Variables pour les variants
    read -p "Ajouter des variants à tous les produits? (o/n): " ajouter_variants_communs
    local variants_communs="[]"
    
    if [[ "$ajouter_variants_communs" == "o"* ]]; then
        echo -e "${YELLOW}${BOLD}=== AJOUT DE VARIANTS COMMUNS ===${RESET}"
        local continuer=true
        local compteur=0
        
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
                    if [ $compteur -eq 0 ]; then
                        variants_communs="[]"
                        break
                    else
                        break
                    fi
                fi
            fi
            
            # Créer le nouveau variant
            local nouveau_variant="{\"size\": \"$taille\", \"color\": \"$couleur\", \"stock\": $stock}"
            
            # Ajouter le variant au tableau existant
            if [ "$compteur" -eq 0 ]; then
                variants_communs="[$nouveau_variant]"
            else
                variants_communs=$(echo "$variants_communs" | jq ". + [$nouveau_variant]")
            fi
            
            compteur=$((compteur+1))
            
            # Demander si l'utilisateur veut ajouter un autre variant
            read -p "Voulez-vous ajouter un autre variant? (o/n): " reponse
            if [[ "$reponse" != "o"* ]]; then
                continuer=false
            fi
        done
        
        # Échapper pour SQL
        variants_communs_escaped=$(echo "$variants_communs" | sed "s/'/''/g")
    fi
    
    # Maintenant on saisit toutes les références à créer
    echo -e "\n${YELLOW}${BOLD}=== SAISIE DES RÉFÉRENCES À CRÉER ===${RESET}"
    echo -e "${BLUE}Entrez toutes les références des produits à créer, une par ligne.${RESET}"
    echo -e "${BLUE}Tapez 'fin' quand vous avez terminé.${RESET}"
    
    local references=()
    local ref=""
    
    while true; do
        read -p "Référence (ou 'fin' pour terminer): " ref
        
        if [ "$ref" == "fin" ]; then
            break
        fi
        
        if [ -z "$ref" ]; then
            echo -e "${RED}Erreur: La référence ne peut pas être vide.${RESET}"
            continue
        fi
        
        # Vérifier si la référence existe déjà
        if produit_existe "$ref"; then
            echo -e "${RED}Attention: Un produit avec la référence '$ref' existe déjà. Ignoré.${RESET}"
            continue
        fi
        
        references+=("$ref")
        echo -e "${GREEN}Référence '$ref' ajoutée à la liste.${RESET}"
    done
    
    # Vérifier si on a des références à traiter
    if [ ${#references[@]} -eq 0 ]; then
        echo -e "${RED}Aucune référence valide n'a été ajoutée.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Demander confirmation avant de créer tous les produits
    echo -e "\n${YELLOW}${BOLD}=== RÉSUMÉ AVANT CRÉATION ===${RESET}"
    echo -e "${BLUE}Vous allez créer ${#references[@]} produit(s) avec les caractéristiques suivantes:${RESET}"
    echo -e "${CYAN}Nom: $nom${RESET}"
    echo -e "${CYAN}Prix: $prix${RESET}"
    echo -e "${CYAN}Marque: $marque${RESET}"
    echo -e "${CYAN}Catégorie ID: $categorie_id${RESET}"
    if [[ "$ajouter_variants_communs" == "o"* ]]; then
        echo -e "${CYAN}Avec ${compteur} variant(s) commun(s)${RESET}"
    else
        echo -e "${CYAN}Sans variants${RESET}"
    fi
    
    read -p "Confirmer la création de tous ces produits? (o/n): " confirmation
    
    if [[ "$confirmation" != "o"* ]]; then
        echo -e "${BLUE}Opération annulée.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 0
    fi
    
    # Créer tous les produits
    echo -e "\n${YELLOW}${BOLD}=== CRÉATION DES PRODUITS ===${RESET}"
    local produits_crees=0
    local produits_echoues=0
    local produits_refs_crees=()
    
    for ref_produit in "${references[@]}"; do
        echo -e "\n${CYAN}Création du produit avec référence: $ref_produit${RESET}"
        
        # Échapper la référence pour SQL
        ref_escape=$(echo "$ref_produit" | sed "s/'/''/g")
        
        # Générer un SKU unique basé sur la référence
        sku="${ref_produit}"
        sku_escape=$(echo "$sku" | sed "s/'/''/g")
        
        # Insérer le produit dans la base de données
        produit_id=$(executer_sql "INSERT INTO products 
            (name, description, price, category_id, brand, brand_id, image_url, images, tags, details, 
            store_type, store_reference, featured, active, new, sku) 
            VALUES 
            ('$nom_escape', '$description_escape', $prix, $categorie_id, '$marque_escape', $marque_id, 
            '$image_url_escape', '{}', '{}', '{}', 
            '$store_type_escape', '$ref_escape', $featured, $active, $new, '$sku_escape')
            RETURNING id")
        
        if [ -z "$produit_id" ]; then
            echo -e "${RED}Erreur lors de la création du produit avec référence '$ref_produit'.${RESET}"
            produits_echoues=$((produits_echoues+1))
            continue
        fi
        
        # Ajouter les variants communs si nécessaire
        if [[ "$ajouter_variants_communs" == "o"* ]]; then
            executer_sql "UPDATE products SET variants = '$variants_communs_escaped'::jsonb WHERE id = $produit_id" > /dev/null 2>&1
        else
            executer_sql "UPDATE products SET variants = '[]'::jsonb WHERE id = $produit_id" > /dev/null 2>&1
        fi
        
        echo -e "${GREEN}Produit créé avec succès! ID: $produit_id${RESET}"
        produits_crees=$((produits_crees+1))
        produits_refs_crees+=("$ref_produit")
    done
    
    # Résumé final
    echo -e "\n${GREEN}${BOLD}=== RÉCAPITULATIF FINAL ===${RESET}"
    echo -e "${GREEN}$produits_crees produit(s) créé(s) avec succès.${RESET}"
    if [ $produits_echoues -gt 0 ]; then
        echo -e "${RED}$produits_echoues produit(s) n'ont pas pu être créés.${RESET}"
    fi
    
    # Vérifier que tous les produits ont bien été créés dans la base de données
    if [ ${#produits_refs_crees[@]} -gt 0 ]; then
        verifier_produits_crees "${produits_refs_crees[@]}"
    fi
    
    # Synchroniser la table product_variants
    synchroniser_product_variants
    
    read -p "Appuyez sur Entrée pour continuer..."
    return 0
}

# Point d'entrée du script
while true; do
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== MENU PRINCIPAL ===${RESET}"
    echo -e "${CYAN}1. Créer un nouveau produit${RESET}"
    echo -e "${CYAN}2. Créer plusieurs produits en série${RESET}"
    echo -e "${CYAN}0. Quitter${RESET}"
    
    read -p "Votre choix (0-2): " choix
    
    case $choix in
        0)
            echo -e "${GREEN}Au revoir!${RESET}"
            exit 0
            ;;
        1)
            creer_produit
            ;;
        2)
            creer_produits_en_serie
            ;;
        *)
            echo -e "${RED}Choix invalide. Veuillez réessayer.${RESET}"
            read -p "Appuyez sur Entrée pour continuer..."
            ;;
    esac
done 