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

# Fonction pour obtenir l'ID du produit à partir de sa référence
function obtenir_id_produit() {
    local ref="$1"
    local ref_escape=$(echo "$ref" | sed "s/'/''/g")
    local produit_id=$(executer_sql "SELECT id FROM corner_products WHERE store_reference = '$ref_escape'")
    echo "$produit_id"
}

# Fonction pour afficher les informations de base du produit
function afficher_info_produit() {
    local produit_id="$1"
    
    echo -e "${YELLOW}${BOLD}=== INFORMATIONS PRODUIT ===${RESET}"
    
    local infos=$(executer_sql "SELECT name, store_reference, price FROM corner_products WHERE id = $produit_id")
    IFS='|' read -r nom reference prix <<< "$infos"
    
    echo -e "${YELLOW}Nom:${RESET} $nom"
    echo -e "${YELLOW}Référence:${RESET} $reference"
    echo -e "${YELLOW}Prix:${RESET} $prix €"
    echo -e "${YELLOW}ID:${RESET} $produit_id"
    echo
}

# Fonction pour afficher les variants d'un produit
function afficher_variants() {
    local produit_id="$1"
    
    echo -e "${YELLOW}${BOLD}=== VARIANTS DU PRODUIT ===${RESET}"
    
    # Récupérer les variants au format JSON
    local variants_json=$(executer_sql "SELECT variants::text FROM corner_products WHERE id = $produit_id")
    
    if [ -z "$variants_json" ] || [ "$variants_json" = "null" ] || [ "$variants_json" = "[]" ]; then
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
        return 1
    fi
    
    # Récupérer les variants actuels
    local variants_json=$(executer_sql "SELECT variants::text FROM corner_products WHERE id = $produit_id")
    
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
    local update_result=$(executer_sql "UPDATE corner_products SET variants = '$nouveau_variants_escaped'::jsonb WHERE id = $produit_id RETURNING id")
    
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
        return 1
    fi
    
    echo -e "${YELLOW}${BOLD}=== MODIFIER UN VARIANT ===${RESET}"
    
    # Récupérer les variants actuels
    local variants_json=$(executer_sql "SELECT variants::text FROM corner_products WHERE id = $produit_id")
    
    # Demander l'index du variant à modifier
    read -p "Entrez l'index du variant à modifier: " index
    
    # Vérifier que l'index est un nombre
    if ! [[ "$index" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Erreur: L'index doit être un nombre entier.${RESET}"
        return 1
    fi
    
    # Vérifier que l'index existe
    local count=$(echo "$variants_json" | jq ". | length")
    if [ "$index" -ge "$count" ]; then
        echo -e "${RED}Erreur: L'index $index n'existe pas.${RESET}"
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
        return 1
    fi
    
    # Mettre à jour le variant
    local variants_modifies=$(echo "$variants_json" | jq ".[$index].size = \"$nouvelle_taille\" | .[$index].color = \"$nouvelle_couleur\" | .[$index].stock = $nouveau_stock")
    
    # Échapper pour SQL
    local variants_modifies_escaped=$(echo "$variants_modifies" | sed "s/'/''/g")
    
    # Mettre à jour la base de données
    local update_result=$(executer_sql "UPDATE corner_products SET variants = '$variants_modifies_escaped'::jsonb WHERE id = $produit_id RETURNING id")
    
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
        return 1
    fi
    
    echo -e "${YELLOW}${BOLD}=== SUPPRIMER UN VARIANT ===${RESET}"
    
    # Récupérer les variants actuels
    local variants_json=$(executer_sql "SELECT variants::text FROM corner_products WHERE id = $produit_id")
    
    # Demander l'index du variant à supprimer
    read -p "Entrez l'index du variant à supprimer: " index
    
    # Vérifier que l'index est un nombre
    if ! [[ "$index" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Erreur: L'index doit être un nombre entier.${RESET}"
        return 1
    fi
    
    # Vérifier que l'index existe
    local count=$(echo "$variants_json" | jq ". | length")
    if [ "$index" -ge "$count" ]; then
        echo -e "${RED}Erreur: L'index $index n'existe pas.${RESET}"
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
    local update_result=$(executer_sql "UPDATE corner_products SET variants = '$variants_modifies_escaped'::jsonb WHERE id = $produit_id RETURNING id")
    
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
    local variants_json=$(executer_sql "SELECT variants::text FROM corner_products WHERE id = $produit_id")
    
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
        local update_result=$(executer_sql "UPDATE corner_products SET variants = '$nouveaux_variants_escaped'::jsonb WHERE id = $produit_id RETURNING id")
        
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

# Fonction pour synchroniser les variants entre les tables
function synchroniser_variants() {
    echo -e "\n${YELLOW}${BOLD}=== SYNCHRONISATION DES VARIANTS ===${RESET}"
    echo -e "${CYAN}Synchronisation en cours...${RESET}"
    
    # Compter les produits et variants avant la synchronisation
    local produits_avant=$(executer_sql "SELECT COUNT(DISTINCT id) FROM corner_products WHERE variants IS NOT NULL AND variants != 'null'::jsonb AND variants != '[]'::jsonb;")
    local variants_avant=$(executer_sql "SELECT COUNT(*) FROM corner_product_variants;")
    
    # 1. Supprimer tous les variants existants dans la table corner_product_variants
    executer_sql "TRUNCATE TABLE corner_product_variants;"
    
    # 2. Recréer tous les variants à partir du JSON dans corner_products
    local produits_traites=0
    local variants_ajoutes=0
    
    # Récupérer tous les produits ayant des variants JSON
    local produits=$(executer_sql "
        SELECT id 
        FROM corner_products 
        WHERE variants IS NOT NULL AND variants != 'null'::jsonb AND variants != '[]'::jsonb
        ORDER BY id;
    ")
    
    for product_id in $produits; do
        # Insérer tous les variants depuis le JSON et joindre avec les colonnes existantes du produit
        local count=$(executer_sql "
            INSERT INTO corner_product_variants (
                corner_product_id, taille, couleur, stock, price,
                product_name, store_reference, category_id, brand_id, active
            )
            SELECT 
                p.id, v->>'size', v->>'color', COALESCE((v->>'stock')::integer, 0), p.price,
                p.name, p.store_reference, p.category_id, p.brand_id, p.active
            FROM 
                corner_products p,
                jsonb_array_elements(p.variants) v
            WHERE 
                p.id = $product_id
            RETURNING id;
        " | wc -l)
        
        ((produits_traites++))
        ((variants_ajoutes += count))
    done
    
    # Compter les produits et variants après la synchronisation
    local produits_apres=$(executer_sql "SELECT COUNT(DISTINCT corner_product_id) FROM corner_product_variants;")
    local variants_apres=$(executer_sql "SELECT COUNT(*) FROM corner_product_variants;")
    
    echo -e "${GREEN}Synchronisation terminée avec succès.${RESET}"
    echo -e "${GREEN}Produits avec variants: $produits_avant → $produits_apres${RESET}"
    echo -e "${GREEN}Variants totaux: $variants_avant → $variants_apres${RESET}"
    echo -e "${GREEN}$produits_traites produits synchronisés.${RESET}"
    echo -e "${GREEN}$variants_ajoutes variants créés depuis JSON.${RESET}"
}

# Fonction pour mettre à jour le prix du produit
function mettre_a_jour_prix() {
    local produit_id="$1"
    
    echo -e "${YELLOW}${BOLD}=== METTRE À JOUR LE PRIX ===${RESET}"
    
    # Obtenir le prix actuel
    local prix_actuel=$(executer_sql "SELECT price FROM corner_products WHERE id = $produit_id")
    echo -e "${BLUE}Prix actuel: $prix_actuel €${RESET}"
    
    # Demander le nouveau prix
    read -p "Nouveau prix: " nouveau_prix
    
    # Vérifier que le prix est un nombre
    if ! [[ "$nouveau_prix" =~ ^[0-9]+(\.[0-9]{1,2})?$ ]]; then
        echo -e "${RED}Erreur: Le prix doit être un nombre (ex: 99.99).${RESET}"
        return 1
    fi
    
    # Mettre à jour le prix du produit
    executer_sql "
        UPDATE corner_products 
        SET price = $nouveau_prix 
        WHERE id = $produit_id;
    "
    
    echo -e "${GREEN}Prix mis à jour avec succès!${RESET}"
    return 0
}

# Fonction pour le menu principal de gestion des variants
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
        echo -e "${CYAN}5. Mettre à jour le prix${RESET}"
        echo -e "${CYAN}6. Synchroniser les variants${RESET}"
        echo -e "${CYAN}0. Retour à la recherche de produit${RESET}"
        
        read -p "Votre choix (0-6): " choix
        
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
                mettre_a_jour_prix "$produit_id"
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
            6)
                synchroniser_variants
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
            *)
                echo -e "${RED}Choix invalide. Veuillez réessayer.${RESET}"
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
        esac
    done
}

# Fonction pour chercher un produit par référence ou nom
function rechercher_produit() {
    echo -e "\n${YELLOW}${BOLD}=== RECHERCHE DE PRODUIT ===${RESET}"
    read -p "Entrez la référence ou une partie du nom du produit: " recherche
    
    if [ -z "$recherche" ]; then
        echo -e "${RED}Erreur: Veuillez entrer une référence ou un nom de produit.${RESET}"
        return 1
    fi
    
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
        return 1
    fi
    
    echo -e "\n${CYAN}Produits trouvés :${RESET}"
    echo -e "${CYAN}ID | Nom | Référence | Prix${RESET}"
    echo "$produits"
    
    read -p "Entrez l'ID du produit à gérer (ou 0 pour annuler): " product_id
    
    if [ "$product_id" = "0" ] || [ -z "$product_id" ]; then
        return 1
    fi
    
    # Vérifier que l'ID existe
    local exists=$(executer_sql "SELECT COUNT(*) FROM corner_products WHERE id = $product_id")
    if [ "$exists" -eq "0" ]; then
        echo -e "${RED}Erreur: Produit introuvable avec l'ID $product_id.${RESET}"
        return 1
    fi
    
    # Lancer la gestion des variants pour ce produit
    gestion_variants "$product_id"
    return 0
}

# Point d'entrée du script
while true; do
    afficher_entete
    echo -e "${YELLOW}${BOLD}=== MENU PRINCIPAL ===${RESET}"
    echo -e "${CYAN}1. Rechercher un produit${RESET}"
    echo -e "${CYAN}2. Synchroniser tous les variants${RESET}"
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
        2)
            synchroniser_variants
            read -p "Appuyez sur Entrée pour continuer..."
            ;;
        *)
            echo -e "${RED}Choix invalide.${RESET}"
            read -p "Appuyez sur Entrée pour continuer..."
            ;;
    esac
done 