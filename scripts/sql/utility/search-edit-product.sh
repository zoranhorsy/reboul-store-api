#!/bin/bash
# Script pour rechercher et modifier un produit par référence

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
    echo -e "${CYAN}======================================================${RESET}"
    echo -e "${CYAN}${BOLD}  RECHERCHE ET MODIFICATION DE PRODUIT PAR RÉFÉRENCE  ${RESET}"
    echo -e "${CYAN}======================================================${RESET}"
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

# Fonction pour afficher un produit
function afficher_produit() {
    local ref="$1"
    local ref_escape=$(echo "$ref" | sed "s/'/''/g")
    
    echo -e "${BLUE}Récupération des données du produit...${RESET}"
    
    # Récupérer les infos générales du produit
    local produit_id=$(executer_sql "SELECT id FROM products WHERE store_reference = '$ref_escape'")
    
    if [ -z "$produit_id" ]; then
        echo -e "${RED}Erreur: Produit non trouvé.${RESET}"
        return 1
    fi
    
    # Afficher les informations de base
    echo -e "${YELLOW}${BOLD}=== INFORMATIONS PRODUIT ===${RESET}"
    echo -e "${YELLOW}ID:${RESET} $produit_id"
    
    local nom=$(executer_sql "SELECT name FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Nom:${RESET} $nom"
    
    local prix=$(executer_sql "SELECT price FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Prix:${RESET} $prix €"
    
    local ref=$(executer_sql "SELECT store_reference FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Référence:${RESET} $ref"
    
    local type=$(executer_sql "SELECT store_type FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Type:${RESET} $type"
    
    local category_id=$(executer_sql "SELECT category_id FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Catégorie ID:${RESET} $category_id"
    
    local brand=$(executer_sql "SELECT brand FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Marque (texte):${RESET} $brand"
    
    local brand_id=$(executer_sql "SELECT brand_id FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Marque ID:${RESET} $brand_id"
    
    # Afficher les états
    echo -e "\n${YELLOW}${BOLD}=== ÉTATS PRODUIT ===${RESET}"
    local active=$(executer_sql "SELECT CASE WHEN active THEN 'OUI' ELSE 'NON' END FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Actif:${RESET} $active"
    
    local new=$(executer_sql "SELECT CASE WHEN new THEN 'OUI' ELSE 'NON' END FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}Nouveau:${RESET} $new"
    
    local featured=$(executer_sql "SELECT CASE WHEN featured THEN 'OUI' ELSE 'NON' END FROM products WHERE id = $produit_id")
    echo -e "${YELLOW}En vedette:${RESET} $featured"
    
    # Afficher la description
    echo -e "\n${YELLOW}${BOLD}=== DESCRIPTION ===${RESET}"
    local description=$(executer_sql "SELECT description FROM products WHERE id = $produit_id")
    echo -e "$description"
    
    # Afficher les tags
    echo -e "\n${YELLOW}${BOLD}=== TAGS ===${RESET}"
    local tags=$(executer_sql "SELECT COALESCE(array_to_string(tags, ', '), 'Aucun tag') FROM products WHERE id = $produit_id")
    echo -e "$tags"
    
    # Afficher les variants
    echo -e "\n${YELLOW}${BOLD}=== VARIANTS ===${RESET}"
    echo -e "${YELLOW}Taille | Couleur | Stock${RESET}"
    echo -e "${YELLOW}----------------------${RESET}"
    
    # Vérifier si la colonne variants existe et contient des données
    local variants_json=$(executer_sql "SELECT variants::text FROM products WHERE id = $produit_id")
    
    if [ -z "$variants_json" ] || [ "$variants_json" = "null" ]; then
        echo -e "${BLUE}Aucun variant disponible${RESET}"
    else
        # Afficher les variants avec jq si disponible
        if command -v jq &> /dev/null; then
            echo "$variants_json" | jq -r '.[] | "\(.size) | \(.color) | \(.stock)"' 2>/dev/null || echo -e "${BLUE}Format de variants non reconnu${RESET}"
        else
            # Affichage simplifié si jq n'est pas disponible
            echo -e "${BLUE}Variants disponibles (jq non installé pour un meilleur affichage):${RESET}"
            echo "$variants_json"
        fi
    fi
    
    # Afficher les détails
    echo -e "\n${YELLOW}${BOLD}=== DÉTAILS ===${RESET}"
    local details_array=$(executer_sql "SELECT COALESCE(array_to_string(details, ', '), 'Aucun détail') FROM products WHERE id = $produit_id")
    echo -e "$details_array"
    
    return 0
}

# Fonction pour modifier un produit
function modifier_produit() {
    local ref="$1"
    local ref_escape=$(echo "$ref" | sed "s/'/''/g")
    
    # Obtenir l'ID du produit
    local produit_id=$(executer_sql "SELECT id FROM products WHERE store_reference = '$ref_escape'")
    
    if [ -z "$produit_id" ]; then
        echo -e "${RED}Erreur: Produit non trouvé.${RESET}"
        return 1
    fi
    
    # Afficher le menu de modification
    echo -e "\n${YELLOW}${BOLD}=== MENU DE MODIFICATION ===${RESET}"
    echo -e "${CYAN}1. Modifier le nom${RESET}"
    echo -e "${CYAN}2. Modifier le prix${RESET}"
    echo -e "${CYAN}3. Modifier l'état actif (true/false)${RESET}"
    echo -e "${CYAN}4. Modifier l'état nouveau (true/false)${RESET}"
    echo -e "${CYAN}5. Modifier l'état en vedette (true/false)${RESET}"
    echo -e "${CYAN}6. Modifier la description${RESET}"
    echo -e "${CYAN}7. Modifier la catégorie (ID)${RESET}"
    echo -e "${CYAN}8. Modifier la référence store${RESET}"
    echo -e "${CYAN}9. Modifier le type de store${RESET}"
    echo -e "${CYAN}10. Modifier la marque${RESET}"
    echo -e "${CYAN}11. Modifier le SKU${RESET}"
    echo -e "${CYAN}12. Modifier le matériau${RESET}"
    echo -e "${CYAN}13. Modifier le poids${RESET}"
    echo -e "${CYAN}14. Modifier les dimensions${RESET}"
    echo -e "${MAGENTA}15. Modifier les variants (JSON)${RESET}"
    echo -e "${CYAN}16. Modifier l'ID de marque${RESET}"
    echo -e "${CYAN}0. Revenir à la recherche de produit${RESET}"
    
    read -p "Votre choix (0-16): " choix
    
    # Retour à la recherche de produit
    if [[ "$choix" == "0" ]]; then
        return 0
    fi
    
    # Par défaut, utiliser 1 si vide
    choix=${choix:-1}
    
    # Vérifier la validité du choix
    if ! [[ "$choix" =~ ^[0-9]+$ ]] || [ "$choix" -lt 1 ] || [ "$choix" -gt 16 ]; then
        echo -e "${RED}Erreur: Choix invalide. Veuillez choisir entre 0 et 16.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        return 1
    fi
    
    # Gestion spéciale pour l'option variants
    if [[ "$choix" == "15" ]]; then
        modifier_variants "$produit_id"
        return $?
    fi
    
    # Demander la nouvelle valeur en fonction du choix
    case $choix in
        1)
            read -p "Entrez le nouveau nom: " nouvelle_valeur
            if [ -z "$nouvelle_valeur" ]; then
                echo -e "${RED}Erreur: Le nouveau nom ne peut pas être vide.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            # Échapper pour SQL
            nouvelle_valeur=$(echo "$nouvelle_valeur" | sed "s/'/''/g")
            executer_sql "UPDATE products SET name = '$nouvelle_valeur' WHERE id = $produit_id"
            echo -e "${GREEN}Nom modifié avec succès.${RESET}"
            ;;
        2)
            read -p "Entrez le nouveau prix: " nouvelle_valeur
            if ! [[ "$nouvelle_valeur" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
                echo -e "${RED}Erreur: Le prix doit être un nombre décimal valide.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            executer_sql "UPDATE products SET price = $nouvelle_valeur WHERE id = $produit_id"
            echo -e "${GREEN}Prix modifié avec succès.${RESET}"
            ;;
        3|4|5)
            read -p "Nouvelle valeur (true/false): " nouvelle_valeur
            if [[ "$nouvelle_valeur" != "true" && "$nouvelle_valeur" != "false" ]]; then
                echo -e "${RED}Erreur: La valeur doit être 'true' ou 'false'.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            
            local champ
            if [ "$choix" == "3" ]; then
                champ="active"
            elif [ "$choix" == "4" ]; then
                champ="new"
            else
                champ="featured"
            fi
            
            executer_sql "UPDATE products SET $champ = $nouvelle_valeur WHERE id = $produit_id"
            echo -e "${GREEN}État modifié avec succès.${RESET}"
            ;;
        6)
            read -p "Entrez la nouvelle description: " nouvelle_valeur
            # Échapper pour SQL
            nouvelle_valeur=$(echo "$nouvelle_valeur" | sed "s/'/''/g")
            executer_sql "UPDATE products SET description = '$nouvelle_valeur' WHERE id = $produit_id"
            echo -e "${GREEN}Description modifiée avec succès.${RESET}"
            ;;
        7)
            read -p "Entrez le nouvel ID de catégorie: " nouvelle_valeur
            if ! [[ "$nouvelle_valeur" =~ ^[0-9]+$ ]]; then
                echo -e "${RED}Erreur: L'ID de catégorie doit être un nombre entier.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            executer_sql "UPDATE products SET category_id = $nouvelle_valeur WHERE id = $produit_id"
            echo -e "${GREEN}Catégorie modifiée avec succès.${RESET}"
            ;;
        8)
            read -p "Entrez la nouvelle référence store: " nouvelle_valeur
            if [ -z "$nouvelle_valeur" ]; then
                echo -e "${RED}Erreur: La référence ne peut pas être vide.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            # Échapper pour SQL
            nouvelle_valeur=$(echo "$nouvelle_valeur" | sed "s/'/''/g")
            executer_sql "UPDATE products SET store_reference = '$nouvelle_valeur' WHERE id = $produit_id"
            echo -e "${GREEN}Référence modifiée avec succès.${RESET}"
            ;;
        9)
            read -p "Entrez le nouveau type de store: " nouvelle_valeur
            if [ -z "$nouvelle_valeur" ]; then
                echo -e "${RED}Erreur: Le type ne peut pas être vide.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            # Échapper pour SQL
            nouvelle_valeur=$(echo "$nouvelle_valeur" | sed "s/'/''/g")
            executer_sql "UPDATE products SET store_type = '$nouvelle_valeur' WHERE id = $produit_id"
            echo -e "${GREEN}Type de store modifié avec succès.${RESET}"
            ;;
        10)
            read -p "Entrez la nouvelle marque: " nouvelle_valeur
            # Échapper pour SQL
            nouvelle_valeur=$(echo "$nouvelle_valeur" | sed "s/'/''/g")
            executer_sql "UPDATE products SET brand = '$nouvelle_valeur' WHERE id = $produit_id"
            echo -e "${GREEN}Marque modifiée avec succès.${RESET}"
            ;;
        11)
            read -p "Entrez le nouveau SKU: " nouvelle_valeur
            # Échapper pour SQL
            nouvelle_valeur=$(echo "$nouvelle_valeur" | sed "s/'/''/g")
            executer_sql "UPDATE products SET sku = '$nouvelle_valeur' WHERE id = $produit_id"
            echo -e "${GREEN}SKU modifié avec succès.${RESET}"
            ;;
        12)
            read -p "Entrez le nouveau matériau: " nouvelle_valeur
            # Échapper pour SQL
            nouvelle_valeur=$(echo "$nouvelle_valeur" | sed "s/'/''/g")
            executer_sql "UPDATE products SET material = '$nouvelle_valeur' WHERE id = $produit_id"
            echo -e "${GREEN}Matériau modifié avec succès.${RESET}"
            ;;
        13)
            read -p "Entrez le nouveau poids: " nouvelle_valeur
            if ! [[ "$nouvelle_valeur" =~ ^[0-9]+$ ]]; then
                echo -e "${RED}Erreur: Le poids doit être un nombre entier.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            executer_sql "UPDATE products SET weight = $nouvelle_valeur WHERE id = $produit_id"
            echo -e "${GREEN}Poids modifié avec succès.${RESET}"
            ;;
        14)
            read -p "Entrez les nouvelles dimensions: " nouvelle_valeur
            # Échapper pour SQL
            nouvelle_valeur=$(echo "$nouvelle_valeur" | sed "s/'/''/g")
            executer_sql "UPDATE products SET dimensions = '$nouvelle_valeur' WHERE id = $produit_id"
            echo -e "${GREEN}Dimensions modifiées avec succès.${RESET}"
            ;;
        16)
            read -p "Entrez le nouvel ID de marque: " nouvelle_valeur
            if ! [[ "$nouvelle_valeur" =~ ^[0-9]+$ ]]; then
                echo -e "${RED}Erreur: L'ID de marque doit être un nombre entier.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                return 1
            fi
            executer_sql "UPDATE products SET brand_id = $nouvelle_valeur WHERE id = $produit_id"
            echo -e "${GREEN}ID de marque modifié avec succès.${RESET}"
            ;;
    esac
    
    return 0
}

# Fonction pour modifier les variants JSON
function modifier_variants() {
    local produit_id=$1
    
    echo -e "${BLUE}Récupération des variants actuels...${RESET}"
    export PGPASSWORD=$DB_PASSWORD
    
    # Récupérer les variants au format JSON
    variants_json=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT variants::text FROM products WHERE id = $produit_id" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Vérifier si on a récupéré quelque chose
    if [ -z "$variants_json" ] || [ "$variants_json" = "null" ]; then
        echo -e "${YELLOW}Aucun variant trouvé. Création d'un tableau vide.${RESET}"
        variants_json="[]"
    else
        echo -e "${GREEN}Variants existants trouvés.${RESET}"
    fi
    
    # Écrire dans un fichier temporaire
    local temp_file=$(mktemp)
    echo "$variants_json" > "$temp_file"
    
    # Afficher un exemple
    echo -e "${YELLOW}Format attendu: JSON avec tableau de variants${RESET}"
    echo -e "${YELLOW}Exemple:${RESET}"
    echo -e "${YELLOW}[${RESET}"
    echo -e "${YELLOW}  {\"size\": \"EU 42\", \"color\": \"Noir\", \"stock\": 10},${RESET}"
    echo -e "${YELLOW}  {\"size\": \"EU 41\", \"color\": \"Blanc\", \"stock\": 5}${RESET}"
    echo -e "${YELLOW}]${RESET}"
    echo -e "${YELLOW}Ouvrir l'éditeur pour modifier les variants...${RESET}"
    sleep 2
    
    # Ouvrir avec l'éditeur par défaut
    ${EDITOR:-nano} "$temp_file"
    
    # Lire le contenu modifié
    local nouveau_variants=$(cat "$temp_file")
    
    # Vérifier si le JSON est valide
    if ! echo "$nouveau_variants" | jq . >/dev/null 2>&1; then
        echo -e "${RED}Erreur: JSON invalide. Modifications non enregistrées.${RESET}"
        rm "$temp_file"
        return 1
    fi
    
    # Échapper les guillemets simples pour SQL
    nouveau_variants_escaped=$(echo "$nouveau_variants" | sed "s/'/''/g")
    
    # Mettre à jour la base de données
    echo -e "${BLUE}Mise à jour des variants...${RESET}"
    update_result=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "UPDATE products SET variants = '$nouveau_variants_escaped'::jsonb WHERE id = $produit_id RETURNING id")
    
    if [ -z "$update_result" ]; then
        echo -e "${RED}Erreur lors de la mise à jour des variants.${RESET}"
        rm "$temp_file"
        return 1
    fi
    
    # Nettoyer
    rm "$temp_file"
    
    echo -e "${GREEN}Variants mis à jour avec succès!${RESET}"
    return 0
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
        # Afficher le produit
        afficher_produit "$ref_produit"
        
        # Proposer de modifier le produit
        read -p "Voulez-vous modifier ce produit? (o/n): " modifier_choice
        
        if [[ "$modifier_choice" == "o"* ]]; then
            # Boucle de modification
            while true; do
                modifier_produit "$ref_produit"
                
                # Afficher le produit mis à jour après modification
                echo -e "\n${YELLOW}État actuel du produit après modification:${RESET}"
                afficher_produit "$ref_produit"
                
                read -p "Voulez-vous continuer à modifier ce produit? (o/n): " continuer_modif
                if [[ "$continuer_modif" != "o"* ]]; then
                    break
                fi
            done
        fi
    else
        echo -e "${RED}Aucun produit trouvé avec la référence '$ref_produit'.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
    fi
done 