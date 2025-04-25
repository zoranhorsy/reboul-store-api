#!/bin/bash
# Script pour gérer les produits par marque

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

# Fonction pour afficher l'en-tête
function afficher_entete() {
    clear
    echo -e "${CYAN}======================================================${RESET}"
    echo -e "${CYAN}${BOLD}          GESTIONNAIRE DE PRODUITS PAR MARQUE         ${RESET}"
    echo -e "${CYAN}======================================================${RESET}"
    echo ""
}

# Fonction pour exécuter une requête SQL et afficher le résultat
function executer_sql() {
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$1"
}

# Fonction pour lister toutes les marques
function lister_marques() {
    echo "Liste des marques disponibles :"
    echo "--------------------------------"
    # Exécuter la requête pour récupérer toutes les marques (utilisées ou non)
    export PGPASSWORD=$DB_PASSWORD
    
    # Requête unifiée pour récupérer les marques de toutes les sources
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT name FROM (
            SELECT DISTINCT brand as name FROM products WHERE brand IS NOT NULL
            UNION
            SELECT DISTINCT b.name FROM products p 
            JOIN brands b ON p.brand_id = b.id 
            WHERE p.brand_id IS NOT NULL
            UNION
            SELECT name FROM brands
        ) all_brands 
        ORDER BY name;" > /tmp/marques.txt
    
    # Afficher les marques depuis le fichier, une par ligne
    echo "ID | MARQUE"
    echo "---|-----------------"
    id=1
    while read marque; do
        # Supprimer les espaces au début et à la fin
        marque_clean=$(echo "$marque" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        if [ ! -z "$marque_clean" ]; then
            printf "%2d | %s\n" $id "$marque_clean"
            id=$((id+1))
        fi
    done < /tmp/marques.txt
    
    # Supprimer le fichier temporaire
    rm /tmp/marques.txt
    echo "--------------------------------"
    echo "Total: $((id-1)) marques trouvées"
}

# Fonction pour afficher les produits d'une marque
function afficher_produits_marque() {
    local marque=$1
    # Échapper la marque pour SQL
    local marque_escape=$(echo "$marque" | sed "s/'/''/g")
    
    echo "Produits de la marque '$marque' :"
    echo "--------------------------------"
    
    # Vérifier s'il y a des produits
    local nb_produits=$(executer_sql "
        SELECT COUNT(*) FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.brand = '$marque_escape' OR b.name = '$marque_escape';" | grep -Eo '[0-9]+' | head -1)
    
    if [ "$nb_produits" -eq 0 ]; then
        echo "Aucun produit trouvé pour la marque '$marque'."
        echo "--------------------------------"
        echo "Total: 0 produits trouvés"
        return
    fi
    
    # Demander le mode d'affichage
    echo "Mode d'affichage:"
    echo "1. Vue standard (principales informations)"
    echo "2. Vue complète (toutes les informations)"
    echo "3. Vue détaillée des variants"
    read -p "Choisissez le mode d'affichage (1-3): " mode_affichage
    
    if [[ "$mode_affichage" == "3" ]]; then
        # Vue détaillée des variants
        echo ""
        echo "=== AFFICHAGE DÉTAILLÉ DES VARIANTS ==="
        
        # Récupérer tous les produits
        export PGPASSWORD=$DB_PASSWORD
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
            SELECT 
                p.id,
                p.name,
                p.store_reference,
                p.variants
            FROM products p
            LEFT JOIN brands b ON p.brand_id = b.id
            WHERE (p.brand = '$marque_escape' OR b.name = '$marque_escape')
            AND p.variants IS NOT NULL
            ORDER BY p.id;" > /tmp/produits_variants.txt
        
        # Parcourir les produits et afficher les variants
        cat /tmp/produits_variants.txt | while IFS='|' read -r id name ref variants; do
            echo "┌───────────────────────────────────────────────────────────────────────────────────┐"
            echo "│ ID: $id - $name (Réf: $ref)"
            echo "├───────────────────────────────────────────────────────────────────────────────────┤"
            echo "│ VARIANTS:"
            
            # Vérifier si le produit a des variants
            if [ -z "$variants" ]; then
                echo "│   Aucun variant disponible"
            else
                # Utiliser jq pour parser le JSON des variants (si disponible)
                if command -v jq &> /dev/null; then
                    # Extraire les variants avec jq
                    echo "$variants" | jq -r '.[] | "│   Taille: \(.size) | Couleur: \(.color) | Stock: \(.stock)"'
                else
                    # Fallback si jq n'est pas disponible - afficher en brut
                    echo "│   $variants"
                fi
            fi
            
            echo "└───────────────────────────────────────────────────────────────────────────────────┘"
            echo ""
        done
        
        rm /tmp/produits_variants.txt
        
    elif [[ "$mode_affichage" == "2" ]]; then
        # Vue complète
        export PGPASSWORD=$DB_PASSWORD
        echo ""
        echo "Affichage complet des produits:"
        echo "--------------------------------"
        
        # Récupérer tous les produits
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
            SELECT 
                p.id,
                p.name,
                p.price,
                p.store_reference,
                p.store_type,
                p.active,
                p.new,
                p.featured,
                p.description,
                p.category_id,
                p.brand,
                b.name as brand_name,
                p.image_url,
                p.sku,
                p.material,
                p.weight,
                p.dimensions,
                p.rating,
                p.reviews_count,
                ARRAY_TO_STRING(p.images, ', ') as images,
                ARRAY_TO_STRING(p.tags, ', ') as tags,
                ARRAY_TO_STRING(p.details, ', ') as details,
                p.variants
            FROM products p
            LEFT JOIN brands b ON p.brand_id = b.id
            WHERE p.brand = '$marque_escape' OR b.name = '$marque_escape'
            ORDER BY p.id;" > /tmp/produits_complet.txt
        
        # Parcourir les produits et afficher toutes les informations
        cat /tmp/produits_complet.txt | while IFS='|' read -r id name price ref type active new featured description category_id brand brand_name image_url sku material weight dimensions rating reviews_count images tags details variants; do
            echo "┌──────────────────────────────────────────────────────────────────────────────────────┐"
            echo "│ ID: $id"
            echo "├──────────────────────────────────────────────────────────────────────────────────────┤"
            echo "│ Nom: $name"
            echo "│ Prix: $price"
            echo "│ Référence: $ref"
            echo "│ Type: $type"
            echo "│ Actif: $([ "$active" = "t" ] && echo "Oui" || echo "Non")"
            echo "│ Nouveau: $([ "$new" = "t" ] && echo "Oui" || echo "Non")"
            echo "│ En vedette: $([ "$featured" = "t" ] && echo "Oui" || echo "Non")"
            echo "├──────────────────────────────────────────────────────────────────────────────────────┤"
            echo "│ Description: ${description:-Non définie}"
            echo "│ Catégorie ID: ${category_id:-Non définie}"
            echo "│ Marque (texte): ${brand:-Non définie}"
            echo "│ Marque (relation): ${brand_name:-Non définie}"
            echo "│ Image URL: ${image_url:-Non définie}"
            echo "│ SKU: ${sku:-Non défini}"
            echo "├──────────────────────────────────────────────────────────────────────────────────────┤"
            echo "│ Matériel: ${material:-Non défini}"
            echo "│ Poids: ${weight:-Non défini}"
            echo "│ Dimensions: ${dimensions:-Non définies}"
            echo "│ Note: ${rating:-Non définie}"
            echo "│ Nombre d'avis: ${reviews_count:-0}"
            echo "├──────────────────────────────────────────────────────────────────────────────────────┤"
            echo "│ Images: ${images:-Aucune}"
            echo "│ Tags: ${tags:-Aucun}"
            echo "│ Détails: ${details:-Aucun}"
            echo "├──────────────────────────────────────────────────────────────────────────────────────┤"
            echo "│ Variants: "
            
            # Vérifier si le produit a des variants
            if [ -z "$variants" ]; then
                echo "│   Aucun variant disponible"
            else
                # Si jq est disponible, utiliser pour un affichage propre
                if command -v jq &> /dev/null; then
                    # Extraire et afficher les variants avec jq
                    echo "$variants" | jq -r '.[] | "│   Taille: \(.size) | Couleur: \(.color) | Stock: \(.stock)"'
                else
                    # Créer un affichage tabulaire des variants
                    echo "│   TAILLE │ COULEUR │ STOCK"
                    echo "│   ───────┼─────────┼───────"
                    
                    # Extraire les variants avec awk/grep/sed (solution sans jq)
                    echo "$variants" | grep -o '{[^}]*}' | while read variant; do
                        size=$(echo "$variant" | grep -o '"size": "[^"]*"' | cut -d'"' -f4)
                        color=$(echo "$variant" | grep -o '"color": "[^"]*"' | cut -d'"' -f4)
                        stock=$(echo "$variant" | grep -o '"stock": [0-9]*' | awk '{print $2}')
                        
                        printf "│   %-7s │ %-8s │ %-5s\n" "$size" "$color" "$stock"
                    done
                fi
            fi
            
            echo "└──────────────────────────────────────────────────────────────────────────────────────┘"
            echo ""
        done
        
        rm /tmp/produits_complet.txt
        
    else
        # Vue standard
        # Exécuter la requête et stocker les résultats dans un format tabular
        export PGPASSWORD=$DB_PASSWORD
        echo "ID  | NOM                                  | PRIX   | RÉFÉRENCE          | TYPE     | ACTIF | STOCKS PAR COULEUR ET TAILLE                   | ACTION"
        echo "----|--------------------------------------|--------|-------------------|----------|-------|-----------------------------------------------|--------"
        
        # Vérifier si la colonne variants existe dans la table products
        colonne_variants_existe=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'products' AND column_name = 'variants'
            );" | grep -Eo '[tf]' | head -1)
        
        # Préparer la requête SQL en fonction de l'existence de la colonne variants
        if [ "$colonne_variants_existe" = "t" ]; then
            # Si la colonne variants existe, l'inclure dans la requête
            variants_sql="p.variants"
        else
            # Si la colonne variants n'existe pas, retourner NULL
            variants_sql="NULL as variants"
        fi
        
        # Utiliser l'option -t pour supprimer les en-têtes et -A pour désactiver l'alignement
        # Recherche à la fois dans le champ brand et via brand_id dans la table brands
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -A -F'|' -c "
            SELECT 
                p.id, 
                p.name, 
                p.price, 
                p.store_reference, 
                p.store_type, 
                p.active,
                p.new,
                p.featured,
                $variants_sql
            FROM products p
            LEFT JOIN brands b ON p.brand_id = b.id
            WHERE p.brand = '$marque_escape' OR b.name = '$marque_escape'
            ORDER BY p.id;" > /tmp/produits_standard.txt
            
        # Traiter chaque ligne du fichier de résultats
        while IFS='|' read -r id name price ref type active new featured variants; do
            # Tronquer le nom s'il est trop long
            name_display="${name:0:36}"
            if [ ${#name} -gt 36 ]; then
                name_display="${name_display}..."
            fi
            
            # Formater les valeurs booléennes pour un meilleur affichage
            active_display=$([ "$active" = "t" ] && echo "Oui" || echo "Non")
            
            # Afficher un résumé des variants ou "Aucun"
            if [ "$colonne_variants_existe" = "t" ]; then
                if [ -z "$variants" ]; then
                    variants_display="Aucun"
                else
                    # Utiliser jq si disponible
                    if command -v jq &> /dev/null; then
                        # Créer un fichier temporaire pour les variants
                        TEMP_VARIANTS=$(mktemp)
                        echo "$variants" | jq -c '.[]' > "$TEMP_VARIANTS"
                        
                        # Traiter chaque variant
                        variants_grouped=""
                        while read -r variant; do
                            color=$(echo "$variant" | jq -r '.color')
                            size=$(echo "$variant" | jq -r '.size')
                            stock=$(echo "$variant" | jq -r '.stock')
                            
                            # Ajouter à la chaîne si le stock est positif
                            if [ "$stock" -gt 0 ]; then
                                if [ -z "$variants_grouped" ]; then
                                    variants_grouped="$color($size):$stock"
                                else
                                    variants_grouped="$variants_grouped, $color($size):$stock"
                                fi
                            fi
                        done < "$TEMP_VARIANTS"
                        
                        # Nettoyer
                        rm "$TEMP_VARIANTS"
                        
                        # Définir l'affichage
                        if [ -z "$variants_grouped" ]; then
                            variants_display="Stock épuisé"
                        else
                            variants_display="$variants_grouped"
                        fi
                    else
                        # Méthode alternative sans jq (pour les systèmes sans jq)
                        TEMP_VARIANTS=$(mktemp)
                        echo "$variants" | grep -o '{[^}]*}' > "$TEMP_VARIANTS"
                        
                        variants_grouped=""
                        while read -r variant; do
                            color=$(echo "$variant" | grep -o '"color": "[^"]*"' | cut -d'"' -f4)
                            size=$(echo "$variant" | grep -o '"size": "[^"]*"' | cut -d'"' -f4)
                            stock=$(echo "$variant" | grep -o '"stock": [0-9]*' | awk '{print $2}')
                            
                            # Si le stock est positif, ajouter au résumé
                            if [ "$stock" -gt 0 ]; then
                                if [ -z "$variants_grouped" ]; then
                                    variants_grouped="$color($size):$stock"
                                else
                                    variants_grouped="$variants_grouped, $color($size):$stock"
                                fi
                            fi
                        done < "$TEMP_VARIANTS"
                        
                        # Nettoyer
                        rm "$TEMP_VARIANTS"
                        
                        # Définir l'affichage
                        if [ -z "$variants_grouped" ]; then
                            variants_display="Stock épuisé"
                        else
                            variants_display="$variants_grouped"
                        fi
                    fi
                fi
                
                # Afficher avec la colonne des variants
                printf "%4d | %-40s | %6.2f | %-18s | %-8s | %-5s | %-45s | %s\n" \
                    "$id" "$name_display" "$price" "${ref}" "$type" "$active_display" "$variants_display" "[Supprimer]"
            else
                # Afficher sans la colonne des variants
                printf "%4d | %-40s | %6.2f | %-18s | %-8s | %-5s | %-45s | %s\n" \
                    "$id" "$name_display" "$price" "${ref}" "$type" "$active_display" "N/A" "[Supprimer]"
            fi
        done < /tmp/produits_standard.txt
        
        # Nettoyer
        rm /tmp/produits_standard.txt
        
        # Ajouter une option pour supprimer directement un produit
        echo ""
        echo "Pour supprimer un produit, entrez 'D' suivi de l'ID (ex: D34)"
        echo "Pour voir les détails des variants d'un produit, entrez 'V' suivi de l'ID (ex: V55)"
        echo "Ou appuyez sur Entrée pour continuer"
        read -p "Votre choix: " option_choix
        
        # Gestion de l'affichage détaillé des variants
        if [[ "$option_choix" =~ ^[Vv][0-9]+$ ]]; then
            # Extraire l'ID du produit
            product_id=${option_choix#[Vv]}
            
            # Vérifier si le produit existe et appartient à cette marque
            produit_existe=$(executer_sql "
                SELECT COUNT(*) FROM products p
                LEFT JOIN brands b ON p.brand_id = b.id
                WHERE p.id = $product_id 
                AND (p.brand = '$marque_escape' OR b.name = '$marque_escape');" | grep -Eo '[0-9]+' | head -1)
            
            if [ "$produit_existe" -eq 0 ]; then
                echo "Erreur: Le produit #$product_id n'existe pas ou n'appartient pas à la marque '$marque_choisie'."
                read -p "Appuyez sur Entrée pour continuer..."
            else
                # Afficher les détails du produit et ses variants
                echo ""
                echo "Détails des variants du produit (ID: $product_id):"
                export PGPASSWORD=$DB_PASSWORD
                
                # Récupérer les informations du produit
                product_info=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
                    SELECT 
                        name, 
                        store_reference,
                        variants
                    FROM products 
                    WHERE id = $product_id;" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
                
                # Extraire les valeurs
                name=$(echo "$product_info" | cut -d'|' -f1)
                reference=$(echo "$product_info" | cut -d'|' -f2)
                variants=$(echo "$product_info" | cut -d'|' -f3)
                
                echo "┌───────────────────────────────────────────────────────────────────────────────────┐"
                echo "│ Nom: $name"
                echo "│ Référence: $reference"
                echo "├───────────────────────────────────────────────────────────────────────────────────┤"
                echo "│ VARIANTS DISPONIBLES:"
                
                # Vérifier si le produit a des variants
                if [ -z "$variants" ]; then
                    echo "│   Aucun variant disponible"
                else
                    # Si jq est disponible, utiliser pour un affichage propre
                    if command -v jq &> /dev/null; then
                        # Extraire et afficher les variants avec jq
                        echo "$variants" | jq -r '.[] | "│   Taille: \(.size) | Couleur: \(.color) | Stock: \(.stock)"'
                    else
                        # Créer un affichage tabulaire des variants
                        echo "│   TAILLE │ COULEUR │ STOCK"
                        echo "│   ───────┼─────────┼───────"
                        
                        # Extraire les variants avec awk/grep/sed (solution sans jq)
                        echo "$variants" | grep -o '{[^}]*}' | while read variant; do
                            size=$(echo "$variant" | grep -o '"size": "[^"]*"' | cut -d'"' -f4)
                            color=$(echo "$variant" | grep -o '"color": "[^"]*"' | cut -d'"' -f4)
                            stock=$(echo "$variant" | grep -o '"stock": [0-9]*' | awk '{print $2}')
                            
                            printf "│   %-7s │ %-8s │ %-5s\n" "$size" "$color" "$stock"
                        done
                    fi
                fi
                
                echo "└───────────────────────────────────────────────────────────────────────────────────┘"
                read -p "Appuyez sur Entrée pour continuer..."
            fi
        # Gestion de la suppression d'un produit
        elif [[ "$option_choix" =~ ^[Dd][0-9]+$ ]]; then
            # Extraire l'ID du produit
            product_id=${option_choix#[Dd]}
            
            # Vérifier si le produit existe et appartient à cette marque
            produit_existe=$(executer_sql "
                SELECT COUNT(*) FROM products p
                LEFT JOIN brands b ON p.brand_id = b.id
                WHERE p.id = $product_id 
                AND (p.brand = '$marque_escape' OR b.name = '$marque_escape');" | grep -Eo '[0-9]+' | head -1)
            
            if [ "$produit_existe" -eq 0 ]; then
                echo "Erreur: Le produit #$product_id n'existe pas ou n'appartient pas à la marque '$marque_choisie'."
                read -p "Appuyez sur Entrée pour continuer..."
            else
                # Afficher les détails du produit à supprimer
                echo ""
                echo "Détails du produit à supprimer (ID: $product_id):"
                psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
                    SELECT 
                        'Nom: ' || name,
                        'Prix: ' || price,
                        'Référence: ' || store_reference
                    FROM products 
                    WHERE id = $product_id;" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
                
                # Confirmation
                echo ""
                echo "ATTENTION: Cette action est irréversible!"
                read -p "Êtes-vous sûr de vouloir supprimer ce produit? (oui/non): " confirmation
                
                if [[ "$confirmation" == "oui" ]]; then
                    # Supprimer le produit
                    executer_sql "DELETE FROM products WHERE id = $product_id;"
                    echo "Produit #$product_id supprimé avec succès."
                else
                    echo "Suppression annulée."
                fi
                read -p "Appuyez sur Entrée pour continuer..."
            fi
        fi
    fi
    
    echo "--------------------------------"
    echo "Total: $nb_produits produits trouvés"
    
    # Afficher un résumé
    echo ""
    echo "Résumé par type:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT store_type, COUNT(*) as nombre 
        FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.brand = '$marque_escape' OR b.name = '$marque_escape'
        GROUP BY store_type
        ORDER BY nombre DESC;" | while read -r line; do
        echo " - $line"
    done
    
    echo ""
    echo "État des produits:"
    active_count=$(executer_sql "
        SELECT COUNT(*) FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE (p.brand = '$marque_escape' OR b.name = '$marque_escape') AND p.active = true;" | grep -Eo '[0-9]+' | head -1)
    new_count=$(executer_sql "
        SELECT COUNT(*) FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE (p.brand = '$marque_escape' OR b.name = '$marque_escape') AND p.new = true;" | grep -Eo '[0-9]+' | head -1)
    featured_count=$(executer_sql "
        SELECT COUNT(*) FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE (p.brand = '$marque_escape' OR b.name = '$marque_escape') AND p.featured = true;" | grep -Eo '[0-9]+' | head -1)
    
    echo " - Actifs: $active_count sur $nb_produits"
    echo " - Nouveaux: $new_count sur $nb_produits"
    echo " - En vedette: $featured_count sur $nb_produits"
}

# Fonction pour modifier tous les produits d'une marque
function modifier_produits_marque() {
    local marque=$1
    # Échapper la marque pour SQL
    local marque_escape=$(echo "$marque" | sed "s/'/''/g")
    
    echo ""
    echo "=== MODIFICATION EN MASSE - MARQUE: $marque ==="
    echo "Quel champ souhaitez-vous modifier pour tous les produits ?"
    echo "1. État actif (active)"
    echo "2. État nouveau (new)"
    echo "3. État en vedette (featured)"
    echo "4. Type de magasin (store_type)"
    echo "5. Ajouter un préfixe au nom"
    echo "6. Modifier le prix (augmentation/diminution en %)"
    echo "0. Retour"
    
    read -p "Votre choix (0-6): " choix_modif
    
    case $choix_modif in
        0)
            return
            ;;
        1)
            read -p "Nouvel état actif (true/false): " nouvelle_valeur
            if [[ "$nouvelle_valeur" != "true" && "$nouvelle_valeur" != "false" ]]; then
                echo "Erreur: La valeur doit être 'true' ou 'false'."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            
            executer_sql "
                UPDATE products p
                SET active = $nouvelle_valeur
                FROM (
                    SELECT p2.id FROM products p2
                    LEFT JOIN brands b ON p2.brand_id = b.id
                    WHERE p2.brand = '$marque_escape' OR b.name = '$marque_escape'
                ) AS sub
                WHERE p.id = sub.id;"
            echo "État actif modifié pour tous les produits de la marque '$marque'."
            ;;
        2)
            read -p "Nouvel état nouveau (true/false): " nouvelle_valeur
            if [[ "$nouvelle_valeur" != "true" && "$nouvelle_valeur" != "false" ]]; then
                echo "Erreur: La valeur doit être 'true' ou 'false'."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            
            executer_sql "
                UPDATE products p
                SET new = $nouvelle_valeur
                FROM (
                    SELECT p2.id FROM products p2
                    LEFT JOIN brands b ON p2.brand_id = b.id
                    WHERE p2.brand = '$marque_escape' OR b.name = '$marque_escape'
                ) AS sub
                WHERE p.id = sub.id;"
            echo "État nouveau modifié pour tous les produits de la marque '$marque'."
            ;;
        3)
            read -p "Nouvel état en vedette (true/false): " nouvelle_valeur
            if [[ "$nouvelle_valeur" != "true" && "$nouvelle_valeur" != "false" ]]; then
                echo "Erreur: La valeur doit être 'true' ou 'false'."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            
            executer_sql "
                UPDATE products p
                SET featured = $nouvelle_valeur
                FROM (
                    SELECT p2.id FROM products p2
                    LEFT JOIN brands b ON p2.brand_id = b.id
                    WHERE p2.brand = '$marque_escape' OR b.name = '$marque_escape'
                ) AS sub
                WHERE p.id = sub.id;"
            echo "État en vedette modifié pour tous les produits de la marque '$marque'."
            ;;
        4)
            echo "Types disponibles: adult, kids, sneakers, cpcompany"
            read -p "Nouveau type de magasin: " nouvelle_valeur
            if [[ "$nouvelle_valeur" != "adult" && "$nouvelle_valeur" != "kids" && "$nouvelle_valeur" != "sneakers" && "$nouvelle_valeur" != "cpcompany" ]]; then
                echo "Erreur: Type invalide. Utilisez adult, kids, sneakers ou cpcompany."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            
            executer_sql "
                UPDATE products p
                SET store_type = '$nouvelle_valeur'
                FROM (
                    SELECT p2.id FROM products p2
                    LEFT JOIN brands b ON p2.brand_id = b.id
                    WHERE p2.brand = '$marque_escape' OR b.name = '$marque_escape'
                ) AS sub
                WHERE p.id = sub.id;"
            echo "Type de magasin modifié pour tous les produits de la marque '$marque'."
            ;;
        5)
            read -p "Préfixe à ajouter aux noms: " prefixe
            if [ -z "$prefixe" ]; then
                echo "Erreur: Le préfixe ne peut pas être vide."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            
            prefixe_escape=$(echo "$prefixe" | sed "s/'/''/g")
            executer_sql "
                UPDATE products p
                SET name = '$prefixe_escape ' || p.name
                FROM (
                    SELECT p2.id FROM products p2
                    LEFT JOIN brands b ON p2.brand_id = b.id
                    WHERE p2.brand = '$marque_escape' OR b.name = '$marque_escape'
                ) AS sub
                WHERE p.id = sub.id;"
            echo "Préfixe ajouté aux noms de tous les produits de la marque '$marque'."
            ;;
        6)
            read -p "Pourcentage de modification du prix (ex: +10 ou -5): " pct_change
            if ! [[ "$pct_change" =~ ^[+-][0-9]+$ ]]; then
                echo "Erreur: Format invalide. Utilisez +N pour augmenter ou -N pour diminuer."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            
            # Extraire le signe et la valeur
            sign=${pct_change:0:1}
            value=${pct_change:1}
            
            if [ "$sign" = "+" ]; then
                executer_sql "
                    UPDATE products p
                    SET price = price * (1 + $value/100.0)
                    FROM (
                        SELECT p2.id FROM products p2
                        LEFT JOIN brands b ON p2.brand_id = b.id
                        WHERE p2.brand = '$marque_escape' OR b.name = '$marque_escape'
                    ) AS sub
                    WHERE p.id = sub.id;"
                echo "Prix augmenté de $value% pour tous les produits de la marque '$marque'."
            else
                executer_sql "
                    UPDATE products p
                    SET price = price * (1 - $value/100.0)
                    FROM (
                        SELECT p2.id FROM products p2
                        LEFT JOIN brands b ON p2.brand_id = b.id
                        WHERE p2.brand = '$marque_escape' OR b.name = '$marque_escape'
                    ) AS sub
                    WHERE p.id = sub.id;"
                echo "Prix diminué de $value% pour tous les produits de la marque '$marque'."
            fi
            ;;
        *)
            echo "Option invalide."
            ;;
    esac
    
    read -p "Appuyez sur Entrée pour continuer..."
}

# Fonction pour supprimer tous les produits d'une marque
function supprimer_produits_marque() {
    local marque=$1
    # Échapper la marque pour SQL
    local marque_escape=$(echo "$marque" | sed "s/'/''/g")
    
    echo ""
    echo "=== SUPPRESSION EN MASSE - MARQUE: $marque ==="
    echo "ATTENTION: Cette action est irréversible!"
    read -p "Êtes-vous sûr de vouloir supprimer TOUS les produits de la marque '$marque'? (oui/non): " confirmation
    
    if [[ "$confirmation" == "oui" ]]; then
        # Deuxième confirmation pour être vraiment sûr
        read -p "DERNIÈRE CHANCE: Tapez 'SUPPRIMER' pour confirmer la suppression: " derniere_confirmation
        
        if [[ "$derniere_confirmation" == "SUPPRIMER" ]]; then
            # Obtenir le nombre de produits à supprimer pour l'afficher plus tard
            local nb_produits=$(executer_sql "
                SELECT COUNT(*) FROM products p
                LEFT JOIN brands b ON p.brand_id = b.id
                WHERE p.brand = '$marque_escape' OR b.name = '$marque_escape';" | grep -Eo '[0-9]+' | head -1)
            
            # Effectuer la suppression
            executer_sql "
                DELETE FROM products p
                WHERE p.id IN (
                    SELECT p2.id FROM products p2
                    LEFT JOIN brands b ON p2.brand_id = b.id
                    WHERE p2.brand = '$marque_escape' OR b.name = '$marque_escape'
                );"
            echo "$nb_produits produits ont été supprimés de la marque '$marque'."
        else
            echo "Suppression annulée."
        fi
    else
        echo "Suppression annulée."
    fi
    
    read -p "Appuyez sur Entrée pour continuer..."
}

# Fonction pour générer une référence store unique
function generer_reference_store() {
    local marque=$1
    local index=$2
    
    # Prendre les 3 premières lettres de la marque et ajouter un nombre aléatoire + index
    local prefixe=$(echo "$marque" | tr '[:lower:]' '[:upper:]' | sed 's/[^A-Z]//g' | cut -c1-3)
    # Si le préfixe est vide, utiliser PRD
    if [ -z "$prefixe" ]; then
        prefixe="PRD"
    fi
    # Si le préfixe a moins de 3 caractères, compléter avec des X
    while [ ${#prefixe} -lt 3 ]; do
        prefixe="${prefixe}X"
    done
    
    local random_number=$((RANDOM % 1000))
    
    echo "${prefixe}${random_number}${index}"
}

# Fonction pour ajouter des produits à une marque
function ajouter_produits_marque() {
    local marque=$1
    # Échapper la marque pour SQL
    local marque_escape=$(echo "$marque" | sed "s/'/''/g")
    
    echo ""
    echo "=== AJOUT DE PRODUITS - MARQUE: $marque ==="
    
    # Vérifier si la marque existe dans la table brands et récupérer son ID
    local brand_id=$(executer_sql "SELECT id FROM brands WHERE name = '$marque_escape';" | grep -Eo '[0-9]+' | head -1)
    
    # Si la marque n'existe pas dans la table brands, proposer de la créer
    if [ -z "$brand_id" ]; then
        read -p "La marque '$marque' n'existe pas dans la table des marques. Voulez-vous la créer? (o/n): " creer_marque_table
        
        if [[ "$creer_marque_table" == "o"* ]]; then
            read -p "Description de la marque: " description
            description_escape=$(echo "$description" | sed "s/'/''/g")
            
            # Créer la marque dans la table brands
            brand_id=$(executer_sql "
                INSERT INTO brands (name, description, created_at, updated_at) 
                VALUES ('$marque_escape', '$description_escape', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) 
                RETURNING id;" | grep -Eo '[0-9]+' | head -1)
            
            echo "Marque '$marque' créée avec l'ID: $brand_id"
        fi
    else
        echo "La marque '$marque' existe déjà dans la table des marques avec l'ID: $brand_id"
    fi
    
    # Demander comment ajouter les produits
    echo ""
    echo "Comment souhaitez-vous associer les nouveaux produits à la marque?"
    echo "1. Utiliser le champ 'brand' (texte)"
    echo "2. Utiliser le champ 'brand_id' (relation avec la table brands)"
    echo "3. Utiliser les deux"
    read -p "Votre choix (1-3): " choix_relation
    
    # Si on utilise brand_id mais qu'on n'a pas d'ID, on revient au champ brand
    if [[ "$choix_relation" == "2" ]] && [ -z "$brand_id" ]; then
        echo "Impossible d'utiliser brand_id car la marque n'a pas été créée dans la table brands."
        echo "Utilisation du champ 'brand' à la place."
        choix_relation="1"
    fi
    
    # Demander le nombre de produits à ajouter
    read -p "Combien de produits souhaitez-vous ajouter? " nb_produits
    
    if ! [[ "$nb_produits" =~ ^[0-9]+$ ]] || [ "$nb_produits" -le 0 ]; then
        echo "Erreur: Veuillez entrer un nombre valide de produits."
        read -p "Appuyez sur Entrée pour continuer..."
        return
    fi
    
    # Demander des informations communes
    read -p "Type de magasin (adult/kids/sneakers/cpcompany) [adult]: " store_type
    store_type=${store_type:-adult}
    
    if [[ "$store_type" != "adult" && "$store_type" != "kids" && "$store_type" != "sneakers" && "$store_type" != "cpcompany" ]]; then
        echo "Erreur: Type invalide. Utilisation de 'adult' par défaut."
        store_type="adult"
    fi
    
    read -p "Catégorie ID [1]: " category_id
    category_id=${category_id:-1}
    
    read -p "Prix de base [100]: " prix_base
    prix_base=${prix_base:-100}
    
    read -p "Produits actifs (true/false) [true]: " active
    active=${active:-true}
    
    read -p "Produits nouveaux (true/false) [true]: " new
    new=${new:-true}
    
    read -p "Produits en vedette (true/false) [false]: " featured
    featured=${featured:-false}
    
    read -p "Préfixe pour le nom []: " prefixe_nom
    
    echo ""
    echo "Ajout de $nb_produits produits pour la marque '$marque'..."
    echo "--------------------------------"
    
    # Créer tous les produits
    for (( i=1; i<=$nb_produits; i++ )); do
        # Générer des valeurs pour ce produit
        local reference=$(generer_reference_store "$marque" "$i")
        local nom="${prefixe_nom}Produit $marque $i"
        local prix=$(echo "$prix_base + $i" | bc)
        
        # Échapper les chaînes
        local nom_escape=$(echo "$nom" | sed "s/'/''/g")
        local reference_escape=$(echo "$reference" | sed "s/'/''/g")
        
        # Créer le produit
        echo "Création du produit $i/$nb_produits: $nom (Réf: $reference)"
        
        # SQL différent selon le choix de relation avec la marque
        case $choix_relation in
            1) # Uniquement brand (texte)
                executer_sql "
                    INSERT INTO products (
                        name, price, description, store_reference, store_type, 
                        active, new, featured, category_id, brand, created_at
                    ) VALUES (
                        '$nom_escape', $prix, 'Produit de la marque $marque_escape', 
                        '$reference_escape', '$store_type', 
                        $active, $new, $featured, $category_id, 
                        '$marque_escape', CURRENT_TIMESTAMP
                    );"
                ;;
            2) # Uniquement brand_id (relation)
                executer_sql "
                    INSERT INTO products (
                        name, price, description, store_reference, store_type, 
                        active, new, featured, category_id, brand_id, created_at
                    ) VALUES (
                        '$nom_escape', $prix, 'Produit de la marque $marque_escape', 
                        '$reference_escape', '$store_type', 
                        $active, $new, $featured, $category_id, 
                        $brand_id, CURRENT_TIMESTAMP
                    );"
                ;;
            3) # Les deux champs
                executer_sql "
                    INSERT INTO products (
                        name, price, description, store_reference, store_type, 
                        active, new, featured, category_id, brand, brand_id, created_at
                    ) VALUES (
                        '$nom_escape', $prix, 'Produit de la marque $marque_escape', 
                        '$reference_escape', '$store_type', 
                        $active, $new, $featured, $category_id, 
                        '$marque_escape', $brand_id, CURRENT_TIMESTAMP
                    );"
                ;;
        esac
    done
    
    echo "--------------------------------"
    echo "$nb_produits produits ont été ajoutés pour la marque '$marque'."
    read -p "Appuyez sur Entrée pour continuer..."
}

# Fonction pour sélectionner une marque par ID
function selectionner_marque_par_id() {
    # Créer un fichier temporaire avec la liste des marques
    export PGPASSWORD=$DB_PASSWORD
    
    # Récupérer toutes les marques (de toutes les sources)
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT name FROM (
            SELECT DISTINCT brand as name FROM products WHERE brand IS NOT NULL
            UNION
            SELECT DISTINCT b.name FROM products p 
            JOIN brands b ON p.brand_id = b.id 
            WHERE p.brand_id IS NOT NULL
            UNION
            SELECT name FROM brands
        ) all_brands 
        ORDER BY name;" > /tmp/marques_liste.txt
    
    # Filtrer les lignes vides et les espaces
    cat /tmp/marques_liste.txt | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' > /tmp/marques_clean.txt
    
    # Vérifier si l'ID entré est valide
    read -p "Entrez l'ID de la marque (ou 'q' pour quitter): " id_marque
    
    if [[ "$id_marque" == "q" ]]; then
        rm /tmp/marques_liste.txt /tmp/marques_clean.txt
        return 1
    fi
    
    if ! [[ "$id_marque" =~ ^[0-9]+$ ]]; then
        echo "Erreur: Veuillez entrer un ID valide."
        rm /tmp/marques_liste.txt /tmp/marques_clean.txt
        return 1
    fi
    
    # Compter le nombre de marques
    local total_marques=$(wc -l < /tmp/marques_clean.txt)
    
    if [ "$id_marque" -lt 1 ] || [ "$id_marque" -gt "$total_marques" ]; then
        echo "Erreur: ID de marque invalide. Doit être entre 1 et $total_marques."
        rm /tmp/marques_liste.txt /tmp/marques_clean.txt
        return 1
    fi
    
    # Récupérer la marque correspondant à l'ID
    local marque_selectionnee=$(sed "${id_marque}q;d" /tmp/marques_clean.txt)
    
    # Nettoyer
    rm /tmp/marques_liste.txt /tmp/marques_clean.txt
    
    echo "$marque_selectionnee"
    return 0
}

# Fonction pour modifier un produit spécifique par référence
function modifier_produit_specifique() {
    local marque=$1
    # Échapper la marque pour SQL
    local marque_escape=$(echo "$marque" | sed "s/'/''/g")
    
    echo ""
    echo "=== MODIFICATION D'UN PRODUIT SPÉCIFIQUE - MARQUE: $marque ==="
    read -p "Entrez la référence du produit: " reference
    
    if [ -z "$reference" ]; then
        echo "Erreur: La référence ne peut pas être vide."
        read -p "Appuyez sur Entrée pour continuer..."
        return
    fi
    
    # Échapper la référence pour SQL
    local reference_escape=$(echo "$reference" | sed "s/'/''/g")
    
    # Vérifier si le produit existe
    local produit_id=$(executer_sql "
        SELECT p.id FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE (p.brand = '$marque_escape' OR b.name = '$marque_escape')
        AND p.store_reference = '$reference_escape'
        LIMIT 1;" | grep -Eo '[0-9]+' | head -1)
    
    if [ -z "$produit_id" ]; then
        echo "Erreur: Aucun produit avec la référence '$reference' trouvé pour la marque '$marque'."
        read -p "Appuyez sur Entrée pour continuer..."
        return
    fi
    
    # Afficher les détails du produit
    echo ""
    echo "Détails du produit (ID: $produit_id, Réf: $reference):"
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT 
            'Nom: ' || name,
            'Prix: ' || price,
            'Type: ' || store_type,
            'Actif: ' || active,
            'Nouveau: ' || new,
            'En vedette: ' || featured,
            'Catégorie: ' || category_id
        FROM products 
        WHERE id = $produit_id;" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
    
    # Menu de modification
    echo ""
    echo "Champ à modifier:"
    echo "1. Nom"
    echo "2. Prix"
    echo "3. Type de magasin"
    echo "4. État actif"
    echo "5. État nouveau"
    echo "6. État en vedette"
    echo "7. Catégorie"
    echo "0. Retour"
    
    read -p "Votre choix (0-7): " choix_champ
    
    case $choix_champ in
        0)
            return
            ;;
        1)
            read -p "Nouveau nom: " nouvelle_valeur
            if [ -z "$nouvelle_valeur" ]; then
                echo "Erreur: Le nom ne peut pas être vide."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            nouvelle_valeur_escape=$(echo "$nouvelle_valeur" | sed "s/'/''/g")
            executer_sql "UPDATE products SET name = '$nouvelle_valeur_escape' WHERE id = $produit_id;"
            echo "Nom modifié avec succès."
            ;;
        2)
            read -p "Nouveau prix: " nouvelle_valeur
            if ! [[ "$nouvelle_valeur" =~ ^[0-9]+(\.[0-9]+)?$ ]]; then
                echo "Erreur: Prix invalide."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            executer_sql "UPDATE products SET price = $nouvelle_valeur WHERE id = $produit_id;"
            echo "Prix modifié avec succès."
            ;;
        3)
            echo "Types disponibles: adult, kids, sneakers, cpcompany"
            read -p "Nouveau type: " nouvelle_valeur
            if [[ "$nouvelle_valeur" != "adult" && "$nouvelle_valeur" != "kids" && "$nouvelle_valeur" != "sneakers" && "$nouvelle_valeur" != "cpcompany" ]]; then
                echo "Erreur: Type invalide."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            executer_sql "UPDATE products SET store_type = '$nouvelle_valeur' WHERE id = $produit_id;"
            echo "Type modifié avec succès."
            ;;
        4)
            read -p "Nouvel état actif (true/false): " nouvelle_valeur
            if [[ "$nouvelle_valeur" != "true" && "$nouvelle_valeur" != "false" ]]; then
                echo "Erreur: Valeur invalide."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            executer_sql "UPDATE products SET active = $nouvelle_valeur WHERE id = $produit_id;"
            echo "État actif modifié avec succès."
            ;;
        5)
            read -p "Nouvel état nouveau (true/false): " nouvelle_valeur
            if [[ "$nouvelle_valeur" != "true" && "$nouvelle_valeur" != "false" ]]; then
                echo "Erreur: Valeur invalide."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            executer_sql "UPDATE products SET new = $nouvelle_valeur WHERE id = $produit_id;"
            echo "État nouveau modifié avec succès."
            ;;
        6)
            read -p "Nouvel état en vedette (true/false): " nouvelle_valeur
            if [[ "$nouvelle_valeur" != "true" && "$nouvelle_valeur" != "false" ]]; then
                echo "Erreur: Valeur invalide."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            executer_sql "UPDATE products SET featured = $nouvelle_valeur WHERE id = $produit_id;"
            echo "État en vedette modifié avec succès."
            ;;
        7)
            read -p "Nouvel ID de catégorie: " nouvelle_valeur
            if ! [[ "$nouvelle_valeur" =~ ^[0-9]+$ ]]; then
                echo "Erreur: ID de catégorie invalide."
                read -p "Appuyez sur Entrée pour continuer..."
                return
            fi
            executer_sql "UPDATE products SET category_id = $nouvelle_valeur WHERE id = $produit_id;"
            echo "Catégorie modifiée avec succès."
            ;;
        *)
            echo "Option invalide."
            ;;
    esac
    
    read -p "Appuyez sur Entrée pour continuer..."
}

# Fonction pour supprimer un produit spécifique par référence
function supprimer_produit_specifique() {
    local marque=$1
    # Échapper la marque pour SQL
    local marque_escape=$(echo "$marque" | sed "s/'/''/g")
    
    echo ""
    echo "=== SUPPRESSION D'UN PRODUIT SPÉCIFIQUE - MARQUE: $marque ==="
    read -p "Entrez la référence du produit: " reference
    
    if [ -z "$reference" ]; then
        echo "Erreur: La référence ne peut pas être vide."
        read -p "Appuyez sur Entrée pour continuer..."
        return
    fi
    
    # Échapper la référence pour SQL
    local reference_escape=$(echo "$reference" | sed "s/'/''/g")
    
    # Vérifier si le produit existe
    local produit_id=$(executer_sql "
        SELECT p.id FROM products p
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE (p.brand = '$marque_escape' OR b.name = '$marque_escape')
        AND p.store_reference = '$reference_escape'
        LIMIT 1;" | grep -Eo '[0-9]+' | head -1)
    
    if [ -z "$produit_id" ]; then
        echo "Erreur: Aucun produit avec la référence '$reference' trouvé pour la marque '$marque'."
        read -p "Appuyez sur Entrée pour continuer..."
        return
    fi
    
    # Afficher les détails du produit
    echo ""
    echo "Détails du produit à supprimer (ID: $produit_id, Réf: $reference):"
    export PGPASSWORD=$DB_PASSWORD
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
        SELECT 
            'Nom: ' || name,
            'Prix: ' || price,
            'Référence: ' || store_reference
        FROM products 
        WHERE id = $produit_id;" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
    
    # Confirmation
    echo ""
    echo "ATTENTION: Cette action est irréversible!"
    read -p "Êtes-vous sûr de vouloir supprimer ce produit? (oui/non): " confirmation
    
    if [[ "$confirmation" == "oui" ]]; then
        executer_sql "DELETE FROM products WHERE id = $produit_id;"
        echo "Produit #$produit_id supprimé avec succès."
    else
        echo "Suppression annulée."
    fi
    
    read -p "Appuyez sur Entrée pour continuer..."
}

# Boucle principale
while true; do
    afficher_entete
    echo "=== GESTION DES PRODUITS PAR MARQUE ==="
    echo ""
    
    # Afficher la liste des marques
    lister_marques
    
    # Options principales
    echo ""
    echo "Entrez l'ID d'une marque (1-$(($id-1))) ou 'q' pour quitter: "
    
    read -p "Votre choix: " option_principale
    
    if [[ "$option_principale" == "q" ]]; then
        echo "Au revoir!"
        exit 0
    fi
    
    # Vérifier si l'entrée est un ID de marque valide
    if [[ "$option_principale" =~ ^[0-9]+$ ]] && [ "$option_principale" -ge 1 ] && [ "$option_principale" -lt "$id" ]; then
        # Récupérer la marque correspondant à l'ID entré
        export PGPASSWORD=$DB_PASSWORD
        psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
            SELECT name FROM (
                SELECT DISTINCT brand as name FROM products WHERE brand IS NOT NULL
                UNION
                SELECT DISTINCT b.name FROM products p 
                JOIN brands b ON p.brand_id = b.id 
                WHERE p.brand_id IS NOT NULL
                UNION
                SELECT name FROM brands
            ) all_brands 
            ORDER BY name;" > /tmp/marques_liste.txt
        
        # Filtrer les lignes vides et les espaces
        cat /tmp/marques_liste.txt | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' > /tmp/marques_clean.txt
        
        # Récupérer la marque
        marque_choisie=$(sed "${option_principale}q;d" /tmp/marques_clean.txt)
        
        # Nettoyer
        rm /tmp/marques_liste.txt /tmp/marques_clean.txt
        
        # Si on a récupéré une marque valide, on continue
        if [ ! -z "$marque_choisie" ]; then
            echo "Marque sélectionnée: $marque_choisie"
        else
            echo "Erreur: Impossible de trouver la marque avec l'ID $option_principale."
            read -p "Appuyez sur Entrée pour continuer..."
            continue
        fi
    else
        echo "Option invalide. Veuillez entrer un ID de marque valide ou 'q' pour quitter."
        read -p "Appuyez sur Entrée pour continuer..."
        continue
    fi
    
    # Une fois la marque sélectionnée, on affiche ses produits et le menu de gestion
    while true; do
        afficher_entete
        echo "=== GESTION DE LA MARQUE: $marque_choisie ==="
        echo ""
        
        # Échapper la marque pour SQL
        marque_escape=$(echo "$marque_choisie" | sed "s/'/''/g")
        
        # Afficher les produits de cette marque
        afficher_produits_marque "$marque_choisie"
        
        # Menu des actions pour cette marque
        echo ""
        echo "Actions disponibles pour la marque '$marque_choisie':"
        echo "1. Modifier tous les produits en masse"
        echo "2. Modifier un produit spécifique par référence"
        echo "3. Supprimer tous les produits"
        echo "4. Supprimer un produit spécifique par référence"
        echo "5. Ajouter des produits"
        echo "0. Revenir à la liste des marques"
        
        read -p "Votre choix (0-5): " choix_action
        
        case $choix_action in
            0)
                break
                ;;
            1)
                modifier_produits_marque "$marque_choisie"
                ;;
            2)
                modifier_produit_specifique "$marque_choisie"
                ;;
            3)
                supprimer_produits_marque "$marque_choisie"
                # Vérifier s'il reste des produits pour la marque
                reste_produits=$(executer_sql "
                    SELECT COUNT(*) FROM (
                        SELECT 1 FROM products p WHERE p.brand = '$marque_escape'
                        UNION ALL
                        SELECT 1 FROM products p JOIN brands b ON p.brand_id = b.id WHERE b.name = '$marque_escape'
                    ) AS remaining_products;" | grep -Eo '[0-9]+' | head -1)
                
                if [ "$reste_produits" -eq 0 ]; then
                    echo "Tous les produits ont été supprimés, retour au menu principal."
                    read -p "Appuyez sur Entrée pour continuer..."
                    break
                fi
                ;;
            4)
                supprimer_produit_specifique "$marque_choisie"
                ;;
            5)
                ajouter_produits_marque "$marque_choisie"
                ;;
            *)
                echo "Option invalide."
                read -p "Appuyez sur Entrée pour continuer..."
                ;;
        esac
    done
done 