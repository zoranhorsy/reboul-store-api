#!/bin/bash
# Script interactif pour rechercher et modifier un produit par référence

# Configuration pour Railway
DB_USER="postgres"
DB_NAME="railway"
DB_PASSWORD="wuRWzXkTzKjXDFradojRvRtTDiSuOXos"
DB_HOST="nozomi.proxy.rlwy.net"
DB_PORT="14067"

# Chemin du script SQL
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$SCRIPT_DIR/script.sql"

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
    echo -e "${CYAN}${BOLD}      GESTIONNAIRE DE PRODUITS - BASE DE DONNÉES      ${RESET}"
    echo -e "${CYAN}======================================================${RESET}"
    echo ""
}

# Fonction pour exécuter une requête SQL avec une belle présentation
function executer_requete() {
    local ref=$1
    local choix=${2:-0}
    local nouvelle_valeur=${3:-""}
    
    echo -e "${BLUE}Exécution de la requête...${RESET}"
    export PGPASSWORD=$DB_PASSWORD
    
    # Créer un fichier temporaire pour la sortie
    local temp_output=$(mktemp)
    
    if [ "$choix" == "0" ]; then
        # Mode recherche uniquement
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -v reference="'$ref'" -f "$SCRIPT" > "$temp_output" 2>&1
    else
        # Mode modification
        if [[ "$choix" == "1" || "$choix" == "6" || "$choix" == "8" || "$choix" == "9" || "$choix" == "10" || "$choix" == "11" || "$choix" == "12" || "$choix" == "14" || "$choix" == "15" ]]; then
            # Pour les valeurs textuelles, ajouter des guillemets
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
                -v reference="'$ref'" \
                -v choice="$choix" \
                -v new_value="'$nouvelle_valeur'" \
                -f "$SCRIPT" > "$temp_output" 2>&1
        else
            # Pour les nombres et booléens, ne pas ajouter de guillemets
            psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
                -v reference="'$ref'" \
                -v choice="$choix" \
                -v new_value="$nouvelle_valeur" \
                -f "$SCRIPT" > "$temp_output" 2>&1
        fi
    fi
    
    # Formater l'affichage en utilisant des couleurs pour la lisibilité
    cat "$temp_output" | 
        # Filtrer les lignes techniques
        grep -v "^SET\|^psql.*Time:\|^Connection\|^Password\|^Timing is\|^Line style\|produit_existe\|Vérification pour modification" |
        grep -v "^DO$" |
        # Nettoyer les messages vides et les erreurs non fatales
        sed '/^$/d' | 
        # Formater les valeurs booléennes
        sed 's/^t$/OUI/g' | 
        sed 's/^f$/NON/g' | 
        sed 's/^INFO:/⚠️ /g' |
        # Formater les notices pour les variants et détails
        sed -E 's/^NOTICE:  (.*)$/\1/g' |
        sed -E 's/^psql:[^:]*:[0-9]+: NOTICE:  (.*)$/\1/g' |
        # Supprimer les lignes (1 row) et autres marqueurs techniques
        sed 's/(1 row)//g' |
        sed 's/psql:.*sql:[0-9]\+://g'
    
    # Nettoyer
    rm "$temp_output"
    
    echo ""
}

# Fonction pour modifier les variants JSON
function modifier_variants() {
    local ref=$1
    
    echo -e "${BLUE}Récupération des variants actuels...${RESET}"
    export PGPASSWORD=$DB_PASSWORD
    
    # Vérifier si le produit existe
    product_id=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT id FROM products WHERE store_reference = '$ref'" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    if [ -z "$product_id" ]; then
        echo -e "${RED}Erreur: Produit non trouvé.${RESET}"
        return 1
    fi
    
    echo -e "${BLUE}ID du produit: $product_id${RESET}"
    
    # Récupérer les variants directement au format JSON
    # Utiliser la même approche que dans brand-product-manager.sh
    variants_json=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT variants::jsonb FROM products WHERE id = $product_id" 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Vérifier si on a récupéré quelque chose
    if [ $? -ne 0 ] || [ -z "$variants_json" ] || [ "$variants_json" = "null" ]; then
        echo -e "${YELLOW}Aucun variant trouvé ou format incompatible. Création d'un nouveau JSON vide.${RESET}"
        variants_json="[]"
    else
        echo -e "${GREEN}Variants existants trouvés.${RESET}"
    fi
    
    # Écrire dans un fichier temporaire
    local temp_file=$(mktemp)
    echo "$variants_json" > "$temp_file"
    
    # Montrer l'exemple d'un tableau JSON bien formaté
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
    update_result=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "UPDATE products SET variants = '$nouveau_variants_escaped'::jsonb WHERE id = $product_id RETURNING id")
    
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

# Boucle principale du programme
while true; do
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== RECHERCHE DE PRODUIT ===${RESET}"
    echo -e "${BLUE}Connexion à la base de données Railway${RESET}"
    echo ""

    # Étape 1: Demander la référence du produit
    read -p "Entrez la référence du produit (ou 'q' pour quitter): " ref_produit

    # Vérifier si l'utilisateur veut quitter
    if [[ "$ref_produit" == "q" ]]; then
        echo -e "${GREEN}Au revoir!${RESET}"
        exit 0
    fi

    if [ -z "$ref_produit" ]; then
        echo -e "${RED}Erreur: Vous devez fournir une référence de produit.${RESET}"
        read -p "Appuyez sur Entrée pour continuer..."
        continue
    fi

    # Échapper la référence pour SQL
    ref_produit_escaped=$(echo "$ref_produit" | sed "s/'/''/g") # Échapper les apostrophes

    # Afficher les valeurs des paramètres pour debug
    echo -e "${BLUE}Référence entrée: '$ref_produit'${RESET}"

    # Rechercher le produit
    echo -e "${YELLOW}Recherche du produit...${RESET}"
    executer_requete "$ref_produit_escaped"

    # Demander si l'utilisateur veut modifier le produit
    read -p "Voulez-vous modifier ce produit? (o/n): " modifier

    if [[ "$modifier" != "o"* ]]; then
        read -p "Appuyez sur Entrée pour rechercher un autre produit..."
        continue
    fi

    # Boucle de modification - permet de modifier plusieurs attributs pour le même produit
    while true; do
        # Afficher le menu et demander le choix
        echo ""
        echo -e "${YELLOW}${BOLD}=== MENU DE MODIFICATION ===${RESET}"
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
        echo -e "${CYAN}0. Revenir à la recherche de produit${RESET}"
        read -p "Votre choix (0-15): " choix

        # Retour à la recherche de produit
        if [[ "$choix" == "0" ]]; then
            break
        fi

        # Par défaut, utiliser 1 si vide
        choix=${choix:-1}

        if ! [[ "$choix" =~ ^[1-9]|1[0-5]$ ]]; then
            echo -e "${RED}Erreur: Choix invalide. Veuillez choisir entre 0 et 15.${RESET}"
            read -p "Appuyez sur Entrée pour continuer..."
            continue
        fi

        # Gestion spéciale pour l'option variants
        if [[ "$choix" == "15" ]]; then
            modifier_variants "$ref_produit_escaped"
            
            # Afficher le produit mis à jour après modification des variants
            echo ""
            echo -e "${YELLOW}État actuel du produit:${RESET}"
            executer_requete "$ref_produit_escaped" "0"
            
            read -p "Voulez-vous modifier autre chose sur ce produit? (o/n): " continuer_modif
            if [[ "$continuer_modif" != "o"* ]]; then
                break
            fi
            continue
        fi

        # Demander la nouvelle valeur en fonction du choix
        case $choix in
            1)
                read -p "Entrez le nouveau nom: " nouvelle_valeur
                if [ -z "$nouvelle_valeur" ]; then
                    echo -e "${RED}Erreur: Le nouveau nom ne peut pas être vide.${RESET}"
                    read -p "Appuyez sur Entrée pour continuer..."
                    continue
                fi
                ;;
            2)
                read -p "Entrez le nouveau prix: " nouvelle_valeur
                if ! [[ "$nouvelle_valeur" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
                    echo -e "${RED}Erreur: Le prix doit être un nombre décimal valide.${RESET}"
                    read -p "Appuyez sur Entrée pour continuer..."
                    continue
                fi
                ;;
            3|4|5)
                read -p "Nouvelle valeur (true/false): " nouvelle_valeur
                if [[ "$nouvelle_valeur" != "true" && "$nouvelle_valeur" != "false" ]]; then
                    echo -e "${RED}Erreur: La valeur doit être 'true' ou 'false'.${RESET}"
                    read -p "Appuyez sur Entrée pour continuer..."
                    continue
                fi
                ;;
            6)
                read -p "Entrez la nouvelle description: " nouvelle_valeur
                ;;
            7)
                read -p "Entrez le nouvel ID de catégorie: " nouvelle_valeur
                if ! [[ "$nouvelle_valeur" =~ ^[0-9]+$ ]]; then
                    echo -e "${RED}Erreur: L'ID de catégorie doit être un nombre entier.${RESET}"
                    read -p "Appuyez sur Entrée pour continuer..."
                    continue
                fi
                ;;
            8|9|10|11|12|14)
                read -p "Entrez la nouvelle valeur: " nouvelle_valeur
                ;;
            13)
                read -p "Entrez le nouveau poids: " nouvelle_valeur
                if ! [[ "$nouvelle_valeur" =~ ^[0-9]+$ ]]; then
                    echo -e "${RED}Erreur: Le poids doit être un nombre entier.${RESET}"
                    read -p "Appuyez sur Entrée pour continuer..."
                    continue
                fi
                ;;
        esac

        # Échapper la nouvelle valeur pour SQL
        nouvelle_valeur_escaped=$(echo "$nouvelle_valeur" | sed "s/'/''/g") # Échapper les apostrophes

        # Afficher les valeurs des paramètres pour debug
        case $choix in
            1) echo -e "${BLUE}Modification du nom: '$nouvelle_valeur'${RESET}" ;;
            2) echo -e "${BLUE}Modification du prix: '$nouvelle_valeur'${RESET}" ;;
            3) echo -e "${BLUE}Modification de l'état actif: '$nouvelle_valeur'${RESET}" ;;
            4) echo -e "${BLUE}Modification de l'état nouveau: '$nouvelle_valeur'${RESET}" ;;
            5) echo -e "${BLUE}Modification de l'état en vedette: '$nouvelle_valeur'${RESET}" ;;
            6) echo -e "${BLUE}Modification de la description: '$nouvelle_valeur'${RESET}" ;;
            7) echo -e "${BLUE}Modification de la catégorie: '$nouvelle_valeur'${RESET}" ;;
            8) echo -e "${BLUE}Modification de la référence store: '$nouvelle_valeur'${RESET}" ;;
            9) echo -e "${BLUE}Modification du type de store: '$nouvelle_valeur'${RESET}" ;;
            10) echo -e "${BLUE}Modification de la marque: '$nouvelle_valeur'${RESET}" ;;
            11) echo -e "${BLUE}Modification du SKU: '$nouvelle_valeur'${RESET}" ;;
            12) echo -e "${BLUE}Modification du matériau: '$nouvelle_valeur'${RESET}" ;;
            13) echo -e "${BLUE}Modification du poids: '$nouvelle_valeur'${RESET}" ;;
            14) echo -e "${BLUE}Modification des dimensions: '$nouvelle_valeur'${RESET}" ;;
        esac

        # Exécuter la modification
        echo -e "${YELLOW}Modification en cours...${RESET}"
        executer_requete "$ref_produit_escaped" "$choix" "$nouvelle_valeur_escaped"

        echo -e "${GREEN}Modification terminée!${RESET}"
        
        # Afficher le produit mis à jour
        echo ""
        echo -e "${YELLOW}État actuel du produit:${RESET}"
        executer_requete "$ref_produit_escaped" "0"
        
        # Demander si l'utilisateur veut continuer à modifier ce produit
        read -p "Voulez-vous modifier autre chose sur ce produit? (o/n): " continuer_modif
        if [[ "$continuer_modif" != "o"* ]]; then
            break
        fi
    done
done
