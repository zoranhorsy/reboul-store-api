#!/bin/bash
# Script pour créer un nouveau produit The Corner en remplissant tous les champs

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
    echo -e "${MAGENTA}${BOLD}         CRÉATION DE PRODUIT THE CORNER         ${RESET}"
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
    local count=$(executer_sql "SELECT COUNT(*) FROM corner_products WHERE store_reference = '$ref_escape'")
    
    if [ "$count" -gt "0" ]; then
        return 0 # True
    else
        return 1 # False
    fi
}

# Fonction pour ajouter des variants
function ajouter_variants() {
    local produit_id="$1"
    local variants=()
    local continue_adding="y"
    
    echo -e "\n${YELLOW}${BOLD}=== AJOUTER DES VARIANTS ? ===${RESET}"
    echo -e "${CYAN}1. Oui, ajouter des variants${RESET}"
    echo -e "${CYAN}2. Non, pas de variants${RESET}"
    
    read -p "Votre choix (1-2): " choix_variants
    
    if [ "$choix_variants" -eq 1 ]; then
        while [[ "$continue_adding" == "y" ]]; do
            echo -e "\n${GREEN}Nouveau variant :${RESET}"
            
            read -p "Couleur: " color
            read -p "Taille: " size
            read -p "Stock: " stock
            
            # Validation du stock (doit être un nombre)
            if ! [[ "$stock" =~ ^[0-9]+$ ]]; then
                echo -e "${RED}Le stock doit être un nombre entier${RESET}"
                continue
            fi
            
            # Ajouter le variant au tableau
            variants+=("{\"color\": \"$color\", \"size\": \"$size\", \"stock\": $stock}")
            
            read -p "Ajouter un autre variant? (y/n): " continue_adding
        done
        
        # Construire le tableau JSON de variants
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
        
        # Créer les variants dans la table corner_product_variants
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
        
        echo -e "${GREEN}Variants ajoutés avec succès!${RESET}"
    else
        echo -e "${BLUE}Aucun variant ajouté.${RESET}"
    fi
}

# Fonction pour créer un nouveau produit
function creer_produit() {
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== CRÉATION D'UN NOUVEAU PRODUIT THE CORNER ===${RESET}"
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
    read -p "Ancien prix (optionnel): " ancien_prix
    read -p "Catégorie ID: " categorie_id
    read -p "Marque (texte): " marque
    read -p "Marque ID: " marque_id
    read -p "URL de l'image principale: " image_url
    read -p "SKU: " sku
    
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
    
    # Vérifier que l'ancien prix est un nombre s'il est fourni
    if [ ! -z "$ancien_prix" ] && ! [[ "$ancien_prix" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]]; then
        echo -e "${RED}Erreur: L'ancien prix doit être un nombre (ex: 99.99).${RESET}"
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
    
    local ancien_prix_sql=""
    if [ ! -z "$ancien_prix" ]; then
        ancien_prix_sql=", old_price = $ancien_prix"
    fi
    
    produit_id=$(executer_sql "INSERT INTO corner_products 
        (name, description, price$ancien_prix_sql, category_id, brand, brand_id, 
        image_url, store_reference, featured, active, new, sku) 
        VALUES 
        ('$nom_escape', '$description_escape', $prix, $categorie_id, '$marque_escape', 
        $marque_id, '$image_url_escape', '$ref_escape', $featured, $active, $new, '$sku_escape')
        RETURNING id")
    
    if [ -z "$produit_id" ]; then
        echo -e "${RED}Erreur lors de la création du produit.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    echo -e "${GREEN}Produit créé avec succès! ID: $produit_id${RESET}"
    
    # Ajouter les variants
    ajouter_variants "$produit_id"
    
    echo -e "\n${GREEN}${BOLD}=== PRODUIT THE CORNER CRÉÉ AVEC SUCCÈS ===${RESET}"
    echo -e "${BLUE}ID: $produit_id${RESET}"
    echo -e "${BLUE}Référence: $ref_produit${RESET}"
    echo -e "${BLUE}Nom: $nom${RESET}"
    
    read -p "Appuyez sur Entrée pour continuer..."
    return 0
}

# Fonction pour créer rapidement plusieurs produits
function creer_produits_en_serie() {
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== CRÉATION RAPIDE DE PLUSIEURS PRODUITS THE CORNER ===${RESET}"
    echo -e "${BLUE}Cette fonction permet de créer plusieurs produits avec un modèle commun.${RESET}"
    echo -e "${BLUE}Vous allez d'abord définir un modèle de produit, puis ajouter plusieurs références.${RESET}"
    echo ""

    # Définir le modèle de produit
    echo -e "${CYAN}${BOLD}=== DÉFINITION DU MODÈLE DE PRODUIT ===${RESET}"
    
    # Collecter les informations communes
    read -p "Nom du produit (modèle commun): " nom
    read -p "Description: " description
    read -p "Prix: " prix
    read -p "Ancien prix (optionnel): " ancien_prix
    read -p "Catégorie ID: " categorie_id
    read -p "Marque (texte): " marque
    read -p "Marque ID: " marque_id
    read -p "URL de l'image principale: " image_url
    
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
    
    # Vérifier que l'ancien prix est un nombre s'il est fourni
    if [ ! -z "$ancien_prix" ] && ! [[ "$ancien_prix" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]]; then
        echo -e "${RED}Erreur: L'ancien prix doit être un nombre (ex: 99.99).${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Préparer les valeurs communes pour SQL
    nom_escape=$(echo "$nom" | sed "s/'/''/g")
    description_escape=$(echo "$description" | sed "s/'/''/g")
    marque_escape=$(echo "$marque" | sed "s/'/''/g")
    image_url_escape=$(echo "$image_url" | sed "s/'/''/g")
    
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
    
    # Variables pour les variants communs
    read -p "Ajouter des variants communs à tous les produits? (o/n): " ajouter_variants_communs
    local variants_communs=()
    
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
            read -p "Prix spécifique (laisser vide pour utiliser le prix du produit): " prix_variant
            
            # Vérifier que le stock est un nombre
            if ! [[ "$stock" =~ ^[0-9]+$ ]]; then
                echo -e "${RED}Erreur: Le stock doit être un nombre entier.${RESET}"
                continue
            fi
            
            # Vérifier que le prix est un nombre si fourni
            if [ ! -z "$prix_variant" ] && ! [[ "$prix_variant" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]]; then
                echo -e "${RED}Erreur: Le prix doit être un nombre (ex: 99.99).${RESET}"
                continue
            fi
            
            # Ajouter le variant au tableau
            variants_communs+=("$taille|$couleur|$stock|$prix_variant")
            compteur=$((compteur+1))
            
            # Demander si l'utilisateur veut ajouter un autre variant
            read -p "Voulez-vous ajouter un autre variant? (o/n): " reponse
            if [[ "$reponse" != "o"* ]]; then
                continuer=false
            fi
        done
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
    if [ ${#variants_communs[@]} -gt 0 ]; then
        echo -e "${CYAN}Avec ${#variants_communs[@]} variant(s) commun(s)${RESET}"
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
        
        # Préparer la partie ancien prix de la requête SQL
        local ancien_prix_sql=""
        if [ ! -z "$ancien_prix" ]; then
            ancien_prix_sql=", old_price = $ancien_prix"
        fi
        
        # Insérer le produit dans la base de données
        produit_id=$(executer_sql "INSERT INTO corner_products 
            (name, description, price$ancien_prix_sql, category_id, brand, brand_id, 
            image_url, store_reference, featured, active, new, sku) 
            VALUES 
            ('$nom_escape', '$description_escape', $prix, $categorie_id, '$marque_escape', 
            $marque_id, '$image_url_escape', '$ref_escape', $featured, $active, $new, '$sku_escape')
            RETURNING id")
        
        if [ -z "$produit_id" ]; then
            echo -e "${RED}Erreur lors de la création du produit avec référence '$ref_produit'.${RESET}"
            produits_echoues=$((produits_echoues+1))
            continue
        fi
        
        # Ajouter les variants communs si nécessaire
        if [ ${#variants_communs[@]} -gt 0 ]; then
            echo -e "${BLUE}Ajout des variants pour le produit $ref_produit...${RESET}"
            
            for variant in "${variants_communs[@]}"; do
                IFS='|' read -r taille couleur stock prix_variant <<< "$variant"
                
                local prix_sql="price"
                if [ ! -z "$prix_variant" ]; then
                    prix_sql="$prix_variant"
                fi
                
                local variant_id=$(executer_sql "INSERT INTO corner_product_variants 
                    (corner_product_id, taille, couleur, stock, product_name, store_reference, 
                    category_id, brand_id, price, active) 
                    SELECT $produit_id, '$taille', '$couleur', $stock, name, store_reference, 
                    category_id, brand_id, $prix_sql, true 
                    FROM corner_products WHERE id = $produit_id 
                    RETURNING id")
                
                if [ -z "$variant_id" ]; then
                    echo -e "${RED}Erreur lors de la création d'un variant pour le produit $ref_produit.${RESET}"
                else
                    echo -e "${GREEN}Variant créé avec succès pour le produit $ref_produit! ID: $variant_id${RESET}"
                fi
            done
            
            # Mettre à jour has_variants sur le produit
            executer_sql "UPDATE corner_products SET has_variants = true WHERE id = $produit_id"
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
    
    read -p "Appuyez sur Entrée pour continuer..."
    return 0
}

# Point d'entrée du script
while true; do
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== MENU PRINCIPAL ===${RESET}"
    echo -e "${CYAN}1. Créer un nouveau produit The Corner${RESET}"
    echo -e "${CYAN}2. Créer plusieurs produits The Corner en série${RESET}"
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