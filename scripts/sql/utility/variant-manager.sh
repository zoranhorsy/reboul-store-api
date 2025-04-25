#!/bin/bash
# Script pour gérer les variants d'un produit par référence

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
    echo -e "${MAGENTA}${BOLD}       GESTIONNAIRE DE VARIANTS PAR PRODUIT       ${RESET}"
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
    local count=$(executer_sql "SELECT COUNT(*) FROM products WHERE store_reference = '$ref_escape'")
    
    if [ "$count" -gt "0" ]; then
        return 0 # True
    else
        return 1 # False
    fi
}

# Fonction pour obtenir l'ID du produit à partir de sa référence
function obtenir_id_produit() {
    local ref="$1"
    local ref_escape=$(echo "$ref" | sed "s/'/''/g")
    local produit_id=$(executer_sql "SELECT id FROM products WHERE store_reference = '$ref_escape'")
    echo "$produit_id"
}

# Fonction pour afficher les informations de base du produit
function afficher_info_produit() {
    local produit_id="$1"
    
    echo -e "${YELLOW}${BOLD}=== INFORMATIONS PRODUIT ===${RESET}"
    
    local nom=$(executer_sql "SELECT name FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Nom:${RESET} $nom"
    
    local ref=$(executer_sql "SELECT store_reference FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Référence:${RESET} $ref"
    
    local marque=$(executer_sql "SELECT brand FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Marque:${RESET} $marque"
    
    echo -e "${YELLOW}ID:${RESET} $produit_id"
    echo
}

# Fonction pour afficher les variants
function afficher_variants() {
    local produit_id="$1"
    
    echo -e "${YELLOW}${BOLD}=== VARIANTS DU PRODUIT ===${RESET}"
    
    # Récupérer les variants au format JSON
    local variants_json=$(executer_sql "SELECT variants::text FROM products WHERE id = $produit_id")
    
    if [ -z "$variants_json" ] || [ "$variants_json" = "null" ]; then
        echo -e "${BLUE}Aucun variant disponible pour ce produit${RESET}"
        return 1
    fi
    
    # Afficher les variants avec jq si disponible
    if command -v jq &> /dev/null; then
        echo -e "${CYAN}Index | Taille | Couleur | Stock${RESET}"
        echo -e "${CYAN}--------------------------------${RESET}"
        
        # Afficher chaque variant avec son index
        echo "$variants_json" | jq -r 'to_entries | .[] | "\(.key) | \(.value.size) | \(.value.color) | \(.value.stock)"' 2>/dev/null || 
        echo -e "${RED}Erreur: Format de variants non reconnu${RESET}"
    else
        # Affichage simplifié si jq n'est pas disponible
        echo -e "${RED}L'outil jq n'est pas installé. Affichage brut des variants:${RESET}"
        echo "$variants_json"
    fi
    
    return 0
}

# Fonction pour ajouter un variant
function ajouter_variant() {
    local produit_id="$1"
    
    echo -e "${YELLOW}${BOLD}=== AJOUTER UN VARIANT ===${RESET}"
    
    # Obtenir les détails du variant
    read -p "Taille (ex: EU 42): " taille
    read -p "Couleur: " couleur
    read -p "Stock: " stock
    
    # Vérifier que le stock est un nombre
    if ! [[ "$stock" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Erreur: Le stock doit être un nombre entier.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Récupérer les variants actuels
    local variants_json=$(executer_sql "SELECT variants::text FROM products WHERE id = $produit_id")
    
    # Si pas de variants, créer un tableau vide
    if [ -z "$variants_json" ] || [ "$variants_json" = "null" ]; then
        variants_json="[]"
    fi
    
    # Créer le nouveau variant
    local nouveau_variant="{\"size\": \"$taille\", \"color\": \"$couleur\", \"stock\": $stock}"
    
    # Ajouter le variant au tableau existant
    local nouveau_variants=$(echo "$variants_json" | jq ". + [$nouveau_variant]")
    
    # Échapper pour SQL
    local nouveau_variants_escaped=$(echo "$nouveau_variants" | sed "s/'/''/g")
    
    # Mettre à jour la base de données
    local update_result=$(executer_sql "UPDATE products SET variants = '$nouveau_variants_escaped'::jsonb WHERE id = $produit_id RETURNING id")
    
    if [ -z "$update_result" ]; then
        echo -e "${RED}Erreur lors de l'ajout du variant.${RESET}"
        return 1
    fi
    
    echo -e "${GREEN}Variant ajouté avec succès!${RESET}"
    return 0
}

# Fonction pour modifier un variant
function modifier_variant() {
    local produit_id="$1"
    
    # Afficher les variants pour sélection
    if ! afficher_variants "$produit_id"; then
        echo -e "${RED}Aucun variant à modifier.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    echo -e "${YELLOW}${BOLD}=== MODIFIER UN VARIANT ===${RESET}"
    
    # Récupérer les variants actuels
    local variants_json=$(executer_sql "SELECT variants::text FROM products WHERE id = $produit_id")
    
    # Demander l'index du variant à modifier
    read -p "Entrez l'index du variant à modifier: " index
    
    # Vérifier que l'index est un nombre
    if ! [[ "$index" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Erreur: L'index doit être un nombre entier.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Vérifier que l'index existe
    local count=$(echo "$variants_json" | jq ". | length")
    if [ "$index" -ge "$count" ]; then
        echo -e "${RED}Erreur: L'index $index n'existe pas.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Récupérer les valeurs actuelles
    local taille_actuelle=$(echo "$variants_json" | jq -r ".[$index].size")
    local couleur_actuelle=$(echo "$variants_json" | jq -r ".[$index].color")
    local stock_actuel=$(echo "$variants_json" | jq -r ".[$index].stock")
    
    echo -e "${BLUE}Variant actuel: Taille=$taille_actuelle, Couleur=$couleur_actuelle, Stock=$stock_actuel${RESET}"
    
    # Demander les nouvelles valeurs
    read -p "Nouvelle taille [$taille_actuelle]: " nouvelle_taille
    read -p "Nouvelle couleur [$couleur_actuelle]: " nouvelle_couleur
    read -p "Nouveau stock [$stock_actuel]: " nouveau_stock
    
    # Utiliser les valeurs actuelles si rien n'est entré
    nouvelle_taille=${nouvelle_taille:-$taille_actuelle}
    nouvelle_couleur=${nouvelle_couleur:-$couleur_actuelle}
    nouveau_stock=${nouveau_stock:-$stock_actuel}
    
    # Vérifier que le stock est un nombre
    if ! [[ "$nouveau_stock" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Erreur: Le stock doit être un nombre entier.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Mettre à jour le variant
    local variants_modifies=$(echo "$variants_json" | jq ".[$index].size = \"$nouvelle_taille\" | .[$index].color = \"$nouvelle_couleur\" | .[$index].stock = $nouveau_stock")
    
    # Échapper pour SQL
    local variants_modifies_escaped=$(echo "$variants_modifies" | sed "s/'/''/g")
    
    # Mettre à jour la base de données
    local update_result=$(executer_sql "UPDATE products SET variants = '$variants_modifies_escaped'::jsonb WHERE id = $produit_id RETURNING id")
    
    if [ -z "$update_result" ]; then
        echo -e "${RED}Erreur lors de la modification du variant.${RESET}"
        return 1
    fi
    
    echo -e "${GREEN}Variant modifié avec succès!${RESET}"
    return 0
}

# Fonction pour supprimer un variant
function supprimer_variant() {
    local produit_id="$1"
    
    # Afficher les variants pour sélection
    if ! afficher_variants "$produit_id"; then
        echo -e "${RED}Aucun variant à supprimer.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    echo -e "${YELLOW}${BOLD}=== SUPPRIMER UN VARIANT ===${RESET}"
    
    # Récupérer les variants actuels
    local variants_json=$(executer_sql "SELECT variants::text FROM products WHERE id = $produit_id")
    
    # Demander l'index du variant à supprimer
    read -p "Entrez l'index du variant à supprimer: " index
    
    # Vérifier que l'index est un nombre
    if ! [[ "$index" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Erreur: L'index doit être un nombre entier.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Vérifier que l'index existe
    local count=$(echo "$variants_json" | jq ". | length")
    if [ "$index" -ge "$count" ]; then
        echo -e "${RED}Erreur: L'index $index n'existe pas.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Afficher le variant à supprimer pour confirmation
    local taille=$(echo "$variants_json" | jq -r ".[$index].size")
    local couleur=$(echo "$variants_json" | jq -r ".[$index].color")
    local stock=$(echo "$variants_json" | jq -r ".[$index].stock")
    
    echo -e "${RED}Vous allez supprimer: Taille=$taille, Couleur=$couleur, Stock=$stock${RESET}"
    read -p "Êtes-vous sûr? (o/n): " confirmation
    
    if [[ "$confirmation" != "o"* ]]; then
        echo -e "${BLUE}Suppression annulée.${RESET}"
        return 0
    fi
    
    # Supprimer le variant
    local variants_modifies=$(echo "$variants_json" | jq "del(.[$index])")
    
    # Échapper pour SQL
    local variants_modifies_escaped=$(echo "$variants_modifies" | sed "s/'/''/g")
    
    # Mettre à jour la base de données
    local update_result=$(executer_sql "UPDATE products SET variants = '$variants_modifies_escaped'::jsonb WHERE id = $produit_id RETURNING id")
    
    if [ -z "$update_result" ]; then
        echo -e "${RED}Erreur lors de la suppression du variant.${RESET}"
        return 1
    fi
    
    echo -e "${GREEN}Variant supprimé avec succès!${RESET}"
    return 0
}

# Fonction pour ajouter plusieurs variants
function ajouter_plusieurs_variants() {
    local produit_id="$1"
    
    echo -e "${YELLOW}${BOLD}=== AJOUTER PLUSIEURS VARIANTS ===${RESET}"
    
    # Récupérer les variants actuels
    local variants_json=$(executer_sql "SELECT variants::text FROM products WHERE id = $produit_id")
    
    # Si pas de variants, créer un tableau vide
    if [ -z "$variants_json" ] || [ "$variants_json" = "null" ]; then
        variants_json="[]"
    fi
    
    local nouveaux_variants="$variants_json"
    local continuer=true
    local compteur=0
    
    while $continuer; do
        echo -e "${CYAN}=== Variant #$((compteur+1)) ===${RESET}"
        
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
                    echo -e "${RED}Aucun variant n'a été ajouté.${RESET}"
                    return 1
                else
                    break
                fi
            fi
        fi
        
        # Créer le nouveau variant
        local nouveau_variant="{\"size\": \"$taille\", \"color\": \"$couleur\", \"stock\": $stock}"
        
        # Ajouter le variant au tableau existant
        nouveaux_variants=$(echo "$nouveaux_variants" | jq ". + [$nouveau_variant]")
        
        compteur=$((compteur+1))
        
        # Demander si l'utilisateur veut ajouter un autre variant
        read -p "Voulez-vous ajouter un autre variant? (o/n): " reponse
        if [[ "$reponse" != "o"* ]]; then
            continuer=false
        fi
    done
    
    if [ $compteur -gt 0 ]; then
        # Échapper pour SQL
        local nouveaux_variants_escaped=$(echo "$nouveaux_variants" | sed "s/'/''/g")
        
        # Mettre à jour la base de données
        local update_result=$(executer_sql "UPDATE products SET variants = '$nouveaux_variants_escaped'::jsonb WHERE id = $produit_id RETURNING id")
        
        if [ -z "$update_result" ]; then
            echo -e "${RED}Erreur lors de l'ajout des variants.${RESET}"
            return 1
        fi
        
        echo -e "${GREEN}$compteur variant(s) ajouté(s) avec succès!${RESET}"
    else
        echo -e "${BLUE}Aucun variant n'a été ajouté.${RESET}"
    fi
    
    return 0
}

# Fonction pour supprimer plusieurs variants
function supprimer_plusieurs_variants() {
    local produit_id="$1"
    
    # Afficher les variants pour sélection
    if ! afficher_variants "$produit_id"; then
        echo -e "${RED}Aucun variant à supprimer.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    echo -e "${YELLOW}${BOLD}=== SUPPRIMER PLUSIEURS VARIANTS ===${RESET}"
    
    # Récupérer les variants actuels
    local variants_json=$(executer_sql "SELECT variants::text FROM products WHERE id = $produit_id")
    
    # Préparer un tableau pour stocker les indices à supprimer
    local indices_a_supprimer=()
    local continuer=true
    
    echo -e "${CYAN}Entrez les indices des variants à supprimer, un par un.${RESET}"
    echo -e "${CYAN}Entrez 'q' quand vous avez terminé.${RESET}"
    
    while $continuer; do
        read -p "Index à supprimer (ou 'q' pour terminer): " index
        
        if [[ "$index" == "q" ]]; then
            continuer=false
            continue
        fi
        
        # Vérifier que l'index est un nombre
        if ! [[ "$index" =~ ^[0-9]+$ ]]; then
            echo -e "${RED}Erreur: L'index doit être un nombre entier.${RESET}"
            continue
        fi
        
        # Vérifier que l'index existe
        local count=$(echo "$variants_json" | jq ". | length")
        if [ "$index" -ge "$count" ]; then
            echo -e "${RED}Erreur: L'index $index n'existe pas.${RESET}"
            continue
        fi
        
        # Vérifier que l'index n'est pas déjà dans la liste
        if [[ " ${indices_a_supprimer[*]} " =~ " $index " ]]; then
            echo -e "${YELLOW}Attention: L'index $index est déjà dans la liste à supprimer.${RESET}"
            continue
        fi
        
        # Afficher le variant à supprimer
        local taille=$(echo "$variants_json" | jq -r ".[$index].size")
        local couleur=$(echo "$variants_json" | jq -r ".[$index].color")
        local stock=$(echo "$variants_json" | jq -r ".[$index].stock")
        
        echo -e "${BLUE}Ajouté à la liste: Index $index - Taille=$taille, Couleur=$couleur, Stock=$stock${RESET}"
        
        # Ajouter l'index à la liste
        indices_a_supprimer+=("$index")
    done
    
    # Vérifier si des indices ont été sélectionnés
    if [ ${#indices_a_supprimer[@]} -eq 0 ]; then
        echo -e "${BLUE}Aucun variant sélectionné pour suppression.${RESET}"
        return 0
    fi
    
    # Afficher un résumé des variants à supprimer
    echo -e "${YELLOW}${BOLD}=== RÉSUMÉ DES VARIANTS À SUPPRIMER ===${RESET}"
    for index in "${indices_a_supprimer[@]}"; do
        local taille=$(echo "$variants_json" | jq -r ".[$index].size")
        local couleur=$(echo "$variants_json" | jq -r ".[$index].color")
        local stock=$(echo "$variants_json" | jq -r ".[$index].stock")
        echo -e "${RED}Index $index - Taille=$taille, Couleur=$couleur, Stock=$stock${RESET}"
    done
    
    # Demander confirmation
    read -p "Êtes-vous sûr de vouloir supprimer ces ${#indices_a_supprimer[@]} variant(s)? (o/n): " confirmation
    
    if [[ "$confirmation" != "o"* ]]; then
        echo -e "${BLUE}Suppression annulée.${RESET}"
        return 0
    fi
    
    # Trier les indices en ordre décroissant pour éviter les problèmes d'index
    IFS=$'\n' indices_tries=($(sort -nr <<<"${indices_a_supprimer[*]}"))
    unset IFS
    
    # Créer une copie des variants
    local variants_modifies="$variants_json"
    
    # Supprimer les variants en commençant par l'index le plus élevé
    for index in "${indices_tries[@]}"; do
        variants_modifies=$(echo "$variants_modifies" | jq "del(.[$index])")
    done
    
    # Échapper pour SQL
    local variants_modifies_escaped=$(echo "$variants_modifies" | sed "s/'/''/g")
    
    # Mettre à jour la base de données
    local update_result=$(executer_sql "UPDATE products SET variants = '$variants_modifies_escaped'::jsonb WHERE id = $produit_id RETURNING id")
    
    if [ -z "$update_result" ]; then
        echo -e "${RED}Erreur lors de la suppression des variants.${RESET}"
        return 1
    fi
    
    echo -e "${GREEN}${#indices_a_supprimer[@]} variant(s) supprimé(s) avec succès!${RESET}"
    return 0
}

# Fonction pour modifier plusieurs variants
function modifier_plusieurs_variants() {
    local produit_id="$1"
    
    # Afficher les variants pour sélection
    if ! afficher_variants "$produit_id"; then
        echo -e "${RED}Aucun variant à modifier.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    echo -e "${YELLOW}${BOLD}=== MODIFIER PLUSIEURS VARIANTS ===${RESET}"
    echo -e "${CYAN}1. Modifier les variants avec la même valeur${RESET}"
    echo -e "${CYAN}2. Modifier chaque variant individuellement${RESET}"
    echo -e "${CYAN}0. Annuler${RESET}"
    
    read -p "Votre choix (0-2): " mode_modification
    
    case $mode_modification in
        0)
            echo -e "${BLUE}Modification annulée.${RESET}"
            return 0
            ;;
        1)
            modifier_plusieurs_variants_meme_valeur "$produit_id"
            return $?
            ;;
        2)
            modifier_plusieurs_variants_individual "$produit_id"
            return $?
            ;;
        *)
            echo -e "${RED}Choix invalide. Modification annulée.${RESET}"
            read -p "Appuyez sur Entrée pour continuer..."
            return 1
            ;;
    esac
}

# Fonction pour modifier plusieurs variants avec la même valeur
function modifier_plusieurs_variants_meme_valeur() {
    local produit_id="$1"
    
    # Récupérer les variants actuels
    local variants_json=$(executer_sql "SELECT variants::text FROM products WHERE id = $produit_id")
    
    # Préparer un tableau pour stocker les indices à modifier
    local indices_a_modifier=()
    local continuer=true
    
    echo -e "${CYAN}Entrez les indices des variants à modifier, un par un.${RESET}"
    echo -e "${CYAN}Entrez 'q' quand vous avez terminé.${RESET}"
    
    while $continuer; do
        read -p "Index à modifier (ou 'q' pour terminer): " index
        
        if [[ "$index" == "q" ]]; then
            continuer=false
            continue
        fi
        
        # Vérifier que l'index est un nombre
        if ! [[ "$index" =~ ^[0-9]+$ ]]; then
            echo -e "${RED}Erreur: L'index doit être un nombre entier.${RESET}"
            continue
        fi
        
        # Vérifier que l'index existe
        local count=$(echo "$variants_json" | jq ". | length")
        if [ "$index" -ge "$count" ]; then
            echo -e "${RED}Erreur: L'index $index n'existe pas.${RESET}"
            continue
        fi
        
        # Vérifier que l'index n'est pas déjà dans la liste
        if [[ " ${indices_a_modifier[*]} " =~ " $index " ]]; then
            echo -e "${YELLOW}Attention: L'index $index est déjà dans la liste à modifier.${RESET}"
            continue
        fi
        
        # Afficher le variant à modifier
        local taille=$(echo "$variants_json" | jq -r ".[$index].size")
        local couleur=$(echo "$variants_json" | jq -r ".[$index].color")
        local stock=$(echo "$variants_json" | jq -r ".[$index].stock")
        
        echo -e "${BLUE}Ajouté à la liste: Index $index - Taille=$taille, Couleur=$couleur, Stock=$stock${RESET}"
        
        # Ajouter l'index à la liste
        indices_a_modifier+=("$index")
    done
    
    # Vérifier si des indices ont été sélectionnés
    if [ ${#indices_a_modifier[@]} -eq 0 ]; then
        echo -e "${BLUE}Aucun variant sélectionné pour modification.${RESET}"
        return 0
    fi
    
    # Afficher un résumé des variants à modifier
    echo -e "${YELLOW}${BOLD}=== RÉSUMÉ DES VARIANTS À MODIFIER ===${RESET}"
    for index in "${indices_a_modifier[@]}"; do
        local taille=$(echo "$variants_json" | jq -r ".[$index].size")
        local couleur=$(echo "$variants_json" | jq -r ".[$index].color")
        local stock=$(echo "$variants_json" | jq -r ".[$index].stock")
        echo -e "${CYAN}Index $index - Taille=$taille, Couleur=$couleur, Stock=$stock${RESET}"
    done
    
    # Demander quelles propriétés modifier
    echo -e "${YELLOW}${BOLD}=== PROPRIÉTÉS À MODIFIER ===${RESET}"
    echo -e "${CYAN}1. Taille${RESET}"
    echo -e "${CYAN}2. Couleur${RESET}"
    echo -e "${CYAN}3. Stock${RESET}"
    echo -e "${CYAN}4. Toutes les propriétés${RESET}"
    echo -e "${CYAN}0. Annuler${RESET}"
    
    read -p "Choisissez les propriétés à modifier (0-4): " choix_proprietes
    
    case $choix_proprietes in
        0)
            echo -e "${BLUE}Modification annulée.${RESET}"
            return 0
            ;;
        1)
            read -p "Nouvelle taille: " nouvelle_taille
            if [ -z "$nouvelle_taille" ]; then
                echo -e "${RED}Erreur: La taille ne peut pas être vide.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            ;;
        2)
            read -p "Nouvelle couleur: " nouvelle_couleur
            if [ -z "$nouvelle_couleur" ]; then
                echo -e "${RED}Erreur: La couleur ne peut pas être vide.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            ;;
        3)
            read -p "Nouveau stock: " nouveau_stock
            if ! [[ "$nouveau_stock" =~ ^[0-9]+$ ]]; then
                echo -e "${RED}Erreur: Le stock doit être un nombre entier.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            ;;
        4)
            read -p "Nouvelle taille: " nouvelle_taille
            read -p "Nouvelle couleur: " nouvelle_couleur
            read -p "Nouveau stock: " nouveau_stock
            
            if [ -z "$nouvelle_taille" ] || [ -z "$nouvelle_couleur" ]; then
                echo -e "${RED}Erreur: La taille et la couleur ne peuvent pas être vides.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            
            if ! [[ "$nouveau_stock" =~ ^[0-9]+$ ]]; then
                echo -e "${RED}Erreur: Le stock doit être un nombre entier.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            ;;
        *)
            echo -e "${RED}Choix invalide. Modification annulée.${RESET}"
            read -p "Appuyez sur Entrée pour continuer..."
            return 1
            ;;
    esac
    
    # Demander confirmation
    read -p "Êtes-vous sûr de vouloir modifier ces ${#indices_a_modifier[@]} variant(s)? (o/n): " confirmation
    
    if [[ "$confirmation" != "o"* ]]; then
        echo -e "${BLUE}Modification annulée.${RESET}"
        return 0
    fi
    
    # Créer une copie des variants
    local variants_modifies="$variants_json"
    
    # Modifier les variants
    for index in "${indices_a_modifier[@]}"; do
        case $choix_proprietes in
            1)
                variants_modifies=$(echo "$variants_modifies" | jq ".[$index].size = \"$nouvelle_taille\"")
                ;;
            2)
                variants_modifies=$(echo "$variants_modifies" | jq ".[$index].color = \"$nouvelle_couleur\"")
                ;;
            3)
                variants_modifies=$(echo "$variants_modifies" | jq ".[$index].stock = $nouveau_stock")
                ;;
            4)
                variants_modifies=$(echo "$variants_modifies" | jq ".[$index].size = \"$nouvelle_taille\" | .[$index].color = \"$nouvelle_couleur\" | .[$index].stock = $nouveau_stock")
                ;;
        esac
    done
    
    # Échapper pour SQL
    local variants_modifies_escaped=$(echo "$variants_modifies" | sed "s/'/''/g")
    
    # Mettre à jour la base de données
    local update_result=$(executer_sql "UPDATE products SET variants = '$variants_modifies_escaped'::jsonb WHERE id = $produit_id RETURNING id")
    
    if [ -z "$update_result" ]; then
        echo -e "${RED}Erreur lors de la modification des variants.${RESET}"
        return 1
    fi
    
    echo -e "${GREEN}${#indices_a_modifier[@]} variant(s) modifié(s) avec succès!${RESET}"
    return 0
}

# Fonction pour modifier plusieurs variants individuellement
function modifier_plusieurs_variants_individual() {
    local produit_id="$1"
    
    # Récupérer les variants actuels
    local variants_json=$(executer_sql "SELECT variants::text FROM products WHERE id = $produit_id")
    
    # Préparer un tableau pour stocker les indices à modifier
    local indices_a_modifier=()
    local continuer=true
    
    echo -e "${CYAN}Entrez les indices des variants à modifier, un par un.${RESET}"
    echo -e "${CYAN}Entrez 'q' quand vous avez terminé.${RESET}"
    
    while $continuer; do
        read -p "Index à modifier (ou 'q' pour terminer): " index
        
        if [[ "$index" == "q" ]]; then
            continuer=false
            continue
        fi
        
        # Vérifier que l'index est un nombre
        if ! [[ "$index" =~ ^[0-9]+$ ]]; then
            echo -e "${RED}Erreur: L'index doit être un nombre entier.${RESET}"
            continue
        fi
        
        # Vérifier que l'index existe
        local count=$(echo "$variants_json" | jq ". | length")
        if [ "$index" -ge "$count" ]; then
            echo -e "${RED}Erreur: L'index $index n'existe pas.${RESET}"
            continue
        fi
        
        # Vérifier que l'index n'est pas déjà dans la liste
        if [[ " ${indices_a_modifier[*]} " =~ " $index " ]]; then
            echo -e "${YELLOW}Attention: L'index $index est déjà dans la liste à modifier.${RESET}"
            continue
        fi
        
        # Afficher le variant à modifier
        local taille=$(echo "$variants_json" | jq -r ".[$index].size")
        local couleur=$(echo "$variants_json" | jq -r ".[$index].color")
        local stock=$(echo "$variants_json" | jq -r ".[$index].stock")
        
        echo -e "${BLUE}Ajouté à la liste: Index $index - Taille=$taille, Couleur=$couleur, Stock=$stock${RESET}"
        
        # Ajouter l'index à la liste
        indices_a_modifier+=("$index")
    done
    
    # Vérifier si des indices ont été sélectionnés
    if [ ${#indices_a_modifier[@]} -eq 0 ]; then
        echo -e "${BLUE}Aucun variant sélectionné pour modification.${RESET}"
        return 0
    fi
    
    # Demander quelles propriétés modifier
    echo -e "${YELLOW}${BOLD}=== PROPRIÉTÉS À MODIFIER ===${RESET}"
    echo -e "${CYAN}1. Taille${RESET}"
    echo -e "${CYAN}2. Couleur${RESET}"
    echo -e "${CYAN}3. Stock${RESET}"
    echo -e "${CYAN}4. Toutes les propriétés${RESET}"
    echo -e "${CYAN}0. Annuler${RESET}"
    
    read -p "Choisissez les propriétés à modifier (0-4): " choix_proprietes
    
    if [ "$choix_proprietes" -eq 0 ]; then
        echo -e "${BLUE}Modification annulée.${RESET}"
        return 0
    fi
    
    if [ "$choix_proprietes" -lt 1 ] || [ "$choix_proprietes" -gt 4 ]; then
        echo -e "${RED}Choix invalide. Modification annulée.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Demander confirmation
    read -p "Vous allez modifier chaque variant individuellement. Continuer? (o/n): " confirmation
    
    if [[ "$confirmation" != "o"* ]]; then
        echo -e "${BLUE}Modification annulée.${RESET}"
        return 0
    fi
    
    # Créer une copie des variants
    local variants_modifies="$variants_json"
    
    # Modifier chaque variant individuellement
    for index in "${indices_a_modifier[@]}"; do
        # Récupérer les valeurs actuelles
        local taille_actuelle=$(echo "$variants_json" | jq -r ".[$index].size")
        local couleur_actuelle=$(echo "$variants_json" | jq -r ".[$index].color")
        local stock_actuel=$(echo "$variants_json" | jq -r ".[$index].stock")
        
        echo -e "\n${YELLOW}${BOLD}=== MODIFIER VARIANT #$index ===${RESET}"
        echo -e "${BLUE}Valeurs actuelles: Taille=$taille_actuelle, Couleur=$couleur_actuelle, Stock=$stock_actuel${RESET}"
        
        case $choix_proprietes in
            1)
                read -p "Nouvelle taille [$taille_actuelle]: " nouvelle_taille
                nouvelle_taille=${nouvelle_taille:-$taille_actuelle}
                if [ -z "$nouvelle_taille" ]; then
                    echo -e "${RED}Erreur: La taille ne peut pas être vide.${RESET}"
                    continue
                fi
                variants_modifies=$(echo "$variants_modifies" | jq ".[$index].size = \"$nouvelle_taille\"")
                ;;
            2)
                read -p "Nouvelle couleur [$couleur_actuelle]: " nouvelle_couleur
                nouvelle_couleur=${nouvelle_couleur:-$couleur_actuelle}
                if [ -z "$nouvelle_couleur" ]; then
                    echo -e "${RED}Erreur: La couleur ne peut pas être vide.${RESET}"
                    continue
                fi
                variants_modifies=$(echo "$variants_modifies" | jq ".[$index].color = \"$nouvelle_couleur\"")
                ;;
            3)
                read -p "Nouveau stock [$stock_actuel]: " nouveau_stock
                nouveau_stock=${nouveau_stock:-$stock_actuel}
                if ! [[ "$nouveau_stock" =~ ^[0-9]+$ ]]; then
                    echo -e "${RED}Erreur: Le stock doit être un nombre entier.${RESET}"
                    continue
                fi
                variants_modifies=$(echo "$variants_modifies" | jq ".[$index].stock = $nouveau_stock")
                ;;
            4)
                read -p "Nouvelle taille [$taille_actuelle]: " nouvelle_taille
                read -p "Nouvelle couleur [$couleur_actuelle]: " nouvelle_couleur
                read -p "Nouveau stock [$stock_actuel]: " nouveau_stock
                
                nouvelle_taille=${nouvelle_taille:-$taille_actuelle}
                nouvelle_couleur=${nouvelle_couleur:-$couleur_actuelle}
                nouveau_stock=${nouveau_stock:-$stock_actuel}
                
                if [ -z "$nouvelle_taille" ] || [ -z "$nouvelle_couleur" ]; then
                    echo -e "${RED}Erreur: La taille et la couleur ne peuvent pas être vides.${RESET}"
                    continue
                fi
                
                if ! [[ "$nouveau_stock" =~ ^[0-9]+$ ]]; then
                    echo -e "${RED}Erreur: Le stock doit être un nombre entier.${RESET}"
                    continue
                fi
                
                variants_modifies=$(echo "$variants_modifies" | jq ".[$index].size = \"$nouvelle_taille\" | .[$index].color = \"$nouvelle_couleur\" | .[$index].stock = $nouveau_stock")
                ;;
        esac
    done
    
    # Échapper pour SQL
    local variants_modifies_escaped=$(echo "$variants_modifies" | sed "s/'/''/g")
    
    # Mettre à jour la base de données
    local update_result=$(executer_sql "UPDATE products SET variants = '$variants_modifies_escaped'::jsonb WHERE id = $produit_id RETURNING id")
    
    if [ -z "$update_result" ]; then
        echo -e "${RED}Erreur lors de la modification des variants.${RESET}"
        return 1
    fi
    
    echo -e "${GREEN}${#indices_a_modifier[@]} variant(s) modifié(s) avec succès!${RESET}"
    return 0
}

# Fonction pour le menu de gestion des variants
function gestion_variants() {
    local produit_id="$1"
    
    while true; do
        afficher_entete
        afficher_info_produit "$produit_id"
        afficher_variants "$produit_id"
        
        echo -e "\n${YELLOW}${BOLD}=== MENU DE GESTION DES VARIANTS ===${RESET}"
        echo -e "${CYAN}1. Ajouter un variant${RESET}"
        echo -e "${CYAN}2. Modifier un variant${RESET}"
        echo -e "${CYAN}3. Supprimer un variant${RESET}"
        echo -e "${CYAN}4. Ajouter plusieurs variants${RESET}"
        echo -e "${CYAN}5. Supprimer plusieurs variants${RESET}"
        echo -e "${CYAN}6. Modifier plusieurs variants${RESET}"
        echo -e "${CYAN}7. Rafraîchir la liste${RESET}"
        echo -e "${CYAN}0. Retour à la recherche de produit${RESET}"
        
        read -p "Votre choix (0-7): " choix
        
        case $choix in
            0)
                return 0
                ;;
            1)
                ajouter_variant "$produit_id"
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
            2)
                modifier_variant "$produit_id"
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
            3)
                supprimer_variant "$produit_id"
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
            4)
                ajouter_plusieurs_variants "$produit_id"
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
            5)
                supprimer_plusieurs_variants "$produit_id"
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
            6)
                modifier_plusieurs_variants "$produit_id"
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
            7)
                echo -e "${BLUE}Rafraîchissement de la liste...${RESET}"
                ;;
            *)
                echo -e "${RED}Choix invalide. Veuillez réessayer.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
        esac
    done
}

# Boucle principale
while true; do
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== RECHERCHE DE PRODUIT ===${RESET}"
    echo -e "${BLUE}Connexion à la base de données Railway${RESET}"
    echo ""

    # Demander la référence
    read -p "Entrez la référence du produit (ou 'q' pour quitter): " ref_produit

    # Quitter si demandé
    if [[ "$ref_produit" == "q" ]]; then
        echo -e "${GREEN}Au revoir!${RESET}"
        exit 0
    fi

    if [ -z "$ref_produit" ]; then
        echo -e "${RED}Erreur: Veuillez entrer une référence de produit.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        continue
    fi

    # Vérifier si le produit existe
    if produit_existe "$ref_produit"; then
        # Obtenir l'ID du produit
        produit_id=$(obtenir_id_produit "$ref_produit")
        
        # Lancer la gestion des variants
        gestion_variants "$produit_id"
    else
        echo -e "${RED}Aucun produit trouvé avec la référence '$ref_produit'.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
    fi
done 