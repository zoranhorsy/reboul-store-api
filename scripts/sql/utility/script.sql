-- Script simple pour rechercher et modifier un produit par référence
-- Usage: psql -v reference="'REFERENCE'" -v choice=1-15 -v new_value="'NOUVELLE_VALEUR'" -f script.sql

\set ON_ERROR_STOP off

-- Définir des valeurs par défaut pour les variables si elles ne sont pas définies
\if :{?reference}
\else
    \set reference ''
\endif

\if :{?choice}
\else
    \set choice 0
\endif

\if :{?new_value}
\else
    \set new_value ''
\endif

-- Afficher la référence pour debug
\echo 'Référence reçue: ' :reference

-- Rechercher le produit
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN 'Aucun produit trouvé avec cette référence.'
        ELSE 'Produit trouvé:'
    END as message
FROM products 
WHERE store_reference = :reference;

-- Format compact pour l'en-tête du produit
\echo '\n--- PRODUIT ---'
\pset format unaligned
\pset tuples_only on
\echo 'ID | Nom | Prix | Référence | Type | Catégorie | Marque ID'
\echo '---------------------------------------------------------------------'

-- Afficher les infos essentielles du produit en ligne compacte
SELECT
    id || ' | ' || 
    name || ' | ' || 
    price || '€ | ' || 
    store_reference || ' | ' || 
    COALESCE(store_type, '-') || ' | ' || 
    COALESCE(category_id::text, '-') || ' | ' || 
    COALESCE(brand_id::text, '-')
FROM products 
WHERE store_reference = :reference;

\echo '\n--- ÉTAT ---'
\echo 'Actif | Nouveau | Vedette'
\echo '---------------------'
SELECT
    CASE WHEN active THEN 'OUI' ELSE 'NON' END || ' | ' ||
    CASE WHEN new THEN 'OUI' ELSE 'NON' END || ' | ' ||
    CASE WHEN featured THEN 'OUI' ELSE 'NON' END
FROM products 
WHERE store_reference = :reference;

-- Description avec retour à la ligne
\echo '\n--- DESCRIPTION ---'
SELECT description 
FROM products 
WHERE store_reference = :reference;

-- Afficher les variants de manière compacte
\echo '\n--- VARIANTS ---'
\echo 'Taille | Couleur | Stock'
\echo '----------------------'

-- Affichage des variants comme dans brand-product-manager.sh
DO $$
DECLARE
    ref_val TEXT := current_setting('reference', true);
    has_data BOOLEAN := FALSE;
    r RECORD;
BEGIN
    -- Récupérer l'ID du produit
    FOR r IN EXECUTE 
        'SELECT id FROM products WHERE store_reference = $1'
        USING ref_val
    LOOP
        -- Utiliser l'ID pour récupérer les variants
        FOR r IN EXECUTE
            'SELECT * FROM jsonb_array_elements(variants::jsonb) as v 
             FROM products 
             WHERE id = ' || r.id
        LOOP
            has_data := TRUE;
            RAISE NOTICE '%s | %s | %s', 
                COALESCE(r.v->>'size', '-'),
                COALESCE(r.v->>'color', '-'),
                COALESCE(r.v->>'stock', '-');
        END LOOP;
    END LOOP;
    
    IF NOT has_data THEN
        RAISE NOTICE 'Aucun variant disponible';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Erreur lors de la lecture des variants: %', SQLERRM;
END $$;

-- Afficher les tags
\echo '\n--- TAGS ---'
SELECT COALESCE(array_to_string(tags, ', '), 'Aucun tag')
FROM products 
WHERE store_reference = :reference;

-- Afficher les détails
\echo '\n--- DÉTAILS ---'
\echo 'Propriété | Valeur'
\echo '----------------------'

-- Affichage des détails
DO $$
DECLARE
    ref_val TEXT := current_setting('reference', true);
    has_data BOOLEAN := FALSE;
    r RECORD;
    details_exist BOOLEAN;
BEGIN
    -- Vérifier si la colonne details existe
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'details'
    ) INTO details_exist;
    
    IF NOT details_exist THEN
        RAISE NOTICE 'Colonne "details" inexistante dans la table products';
        RETURN;
    END IF;
    
    -- Récupérer l'ID du produit
    FOR r IN EXECUTE 
        'SELECT id FROM products WHERE store_reference = $1'
        USING ref_val
    LOOP
        -- Essayer de récupérer les détails comme JSONB
        BEGIN
            FOR r IN EXECUTE
                'SELECT key, value FROM jsonb_each_text(details::jsonb) 
                 WHERE EXISTS (SELECT 1 FROM products WHERE id = ' || r.id || ')'
            LOOP
                has_data := TRUE;
                RAISE NOTICE '%s | %s', r.key, r.value;
            END LOOP;
        EXCEPTION WHEN others THEN
            -- Si pas en JSONB, essayer comme tableau
            BEGIN
                FOR r IN EXECUTE
                    'SELECT unnest(details) as detail 
                     FROM products 
                     WHERE id = ' || r.id
                LOOP
                    has_data := TRUE;
                    RAISE NOTICE '%s', r.detail;
                END LOOP;
            EXCEPTION WHEN others THEN
                NULL; -- Ignorer les erreurs
            END;
        END;
    END LOOP;
    
    IF NOT has_data THEN
        RAISE NOTICE 'Aucun détail disponible';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Erreur lors de la lecture des détails: %', SQLERRM;
END $$;

-- Réinitialiser le format
\pset format aligned
\pset tuples_only off

-- Vérifier nombre de lignes pour la modification
SELECT 
    COUNT(*) > 0 AS produit_existe,
    :choice::int = 1 AS est_modif_nom,
    :choice::int = 2 AS est_modif_prix,
    :choice::int = 3 AS est_modif_actif,
    :choice::int = 4 AS est_modif_nouveau,
    :choice::int = 5 AS est_modif_vedette,
    :choice::int = 6 AS est_modif_description,
    :choice::int = 7 AS est_modif_category_id,
    :choice::int = 8 AS est_modif_store_reference,
    :choice::int = 9 AS est_modif_store_type,
    :choice::int = 10 AS est_modif_brand,
    :choice::int = 11 AS est_modif_sku,
    :choice::int = 12 AS est_modif_material,
    :choice::int = 13 AS est_modif_weight,
    :choice::int = 14 AS est_modif_dimensions,
    :choice::int = 15 AS est_modif_variants,
    (:choice::int < 1 OR :choice::int > 15) AS choix_invalide
FROM products 
WHERE store_reference = :reference \gset

-- Vérifier si le produit existe pour la modification
\echo 'Vérification pour modification...'

-- Convertir les valeurs en booléens pour \if
\set produit_existe_bool :produit_existe
\set est_modif_nom_bool :est_modif_nom
\set est_modif_prix_bool :est_modif_prix
\set est_modif_actif_bool :est_modif_actif
\set est_modif_nouveau_bool :est_modif_nouveau
\set est_modif_vedette_bool :est_modif_vedette
\set est_modif_description_bool :est_modif_description
\set est_modif_category_id_bool :est_modif_category_id
\set est_modif_store_reference_bool :est_modif_store_reference
\set est_modif_store_type_bool :est_modif_store_type
\set est_modif_brand_bool :est_modif_brand
\set est_modif_sku_bool :est_modif_sku
\set est_modif_material_bool :est_modif_material
\set est_modif_weight_bool :est_modif_weight
\set est_modif_dimensions_bool :est_modif_dimensions
\set est_modif_variants_bool :est_modif_variants
\set choix_invalide_bool :choix_invalide

-- Effectuer la mise à jour si le produit existe
\if :produit_existe_bool
    -- Option 1: Modifier le nom
    \if :est_modif_nom_bool
        \echo 'Tentative de modification du nom...'
        UPDATE products 
        SET name = :new_value 
        WHERE store_reference = :reference;
        
        SELECT 'Nom du produit modifié avec succès' AS resultat;
    \endif
    
    -- Option 2: Modifier le prix
    \if :est_modif_prix_bool
        \echo 'Tentative de modification du prix...'
        UPDATE products 
        SET price = :new_value::decimal 
        WHERE store_reference = :reference;
        
        SELECT 'Prix du produit modifié avec succès' AS resultat;
    \endif
    
    -- Option 3: Modifier l'état actif
    \if :est_modif_actif_bool
        \echo 'Tentative de modification de l''état actif...'
        UPDATE products 
        SET active = (:new_value = 'true')::boolean 
        WHERE store_reference = :reference;
        
        SELECT 'État actif du produit modifié avec succès' AS resultat;
    \endif
    
    -- Option 4: Modifier l'état nouveau
    \if :est_modif_nouveau_bool
        \echo 'Tentative de modification de l''état nouveau...'
        UPDATE products 
        SET new = (:new_value = 'true')::boolean 
        WHERE store_reference = :reference;
        
        SELECT 'État nouveau du produit modifié avec succès' AS resultat;
    \endif
    
    -- Option 5: Modifier l'état en vedette
    \if :est_modif_vedette_bool
        \echo 'Tentative de modification de l''état en vedette...'
        UPDATE products 
        SET featured = (:new_value = 'true')::boolean 
        WHERE store_reference = :reference;
        
        SELECT 'État en vedette du produit modifié avec succès' AS resultat;
    \endif
    
    -- Option 6: Modifier la description
    \if :est_modif_description_bool
        \echo 'Tentative de modification de la description...'
        UPDATE products 
        SET description = :new_value
        WHERE store_reference = :reference;
        
        SELECT 'Description du produit modifiée avec succès' AS resultat;
    \endif
    
    -- Option 7: Modifier la catégorie
    \if :est_modif_category_id_bool
        \echo 'Tentative de modification de la catégorie...'
        UPDATE products 
        SET category_id = :new_value::integer
        WHERE store_reference = :reference;
        
        SELECT 'Catégorie du produit modifiée avec succès' AS resultat;
    \endif
    
    -- Option 8: Modifier la référence store
    \if :est_modif_store_reference_bool
        \echo 'Tentative de modification de la référence store...'
        UPDATE products 
        SET store_reference = :new_value
        WHERE store_reference = :reference;
        
        SELECT 'Référence store du produit modifiée avec succès' AS resultat;
    \endif
    
    -- Option 9: Modifier le type de store
    \if :est_modif_store_type_bool
        \echo 'Tentative de modification du type de store...'
        UPDATE products 
        SET store_type = :new_value
        WHERE store_reference = :reference;
        
        SELECT 'Type de store du produit modifié avec succès' AS resultat;
    \endif
    
    -- Option 10: Modifier la marque
    \if :est_modif_brand_bool
        \echo 'Tentative de modification de la marque...'
        UPDATE products 
        SET brand = :new_value
        WHERE store_reference = :reference;
        
        SELECT 'Marque du produit modifiée avec succès' AS resultat;
    \endif
    
    -- Option 11: Modifier le SKU
    \if :est_modif_sku_bool
        \echo 'Tentative de modification du SKU...'
        UPDATE products 
        SET sku = :new_value
        WHERE store_reference = :reference;
        
        SELECT 'SKU du produit modifié avec succès' AS resultat;
    \endif
    
    -- Option 12: Modifier le matériau
    \if :est_modif_material_bool
        \echo 'Tentative de modification du matériau...'
        UPDATE products 
        SET material = :new_value
        WHERE store_reference = :reference;
        
        SELECT 'Matériau du produit modifié avec succès' AS resultat;
    \endif
    
    -- Option 13: Modifier le poids
    \if :est_modif_weight_bool
        \echo 'Tentative de modification du poids...'
        UPDATE products 
        SET weight = :new_value::integer
        WHERE store_reference = :reference;
        
        SELECT 'Poids du produit modifié avec succès' AS resultat;
    \endif
    
    -- Option 14: Modifier les dimensions
    \if :est_modif_dimensions_bool
        \echo 'Tentative de modification des dimensions...'
        UPDATE products 
        SET dimensions = :new_value
        WHERE store_reference = :reference;
        
        SELECT 'Dimensions du produit modifiées avec succès' AS resultat;
    \endif
    
    -- Option 15: Modifier les variants (JSON)
    \if :est_modif_variants_bool
        \echo 'Tentative de modification des variants...'
        -- Essayer de convertir en JSONB si c'est déjà ce format
        BEGIN
            UPDATE products 
            SET variants = :new_value::jsonb
            WHERE store_reference = :reference;
            
            SELECT 'Variants du produit modifiés avec succès (format JSONB)' AS resultat;
        EXCEPTION WHEN others THEN
            -- Si la conversion en JSONB échoue, traiter comme un tableau de texte
            BEGIN
                UPDATE products 
                SET variants = string_to_array(:new_value, ',')
                WHERE store_reference = :reference;
                
                SELECT 'Variants du produit modifiés avec succès (format tableau)' AS resultat;
            EXCEPTION WHEN others THEN
                SELECT 'Erreur lors de la modification des variants' AS resultat;
            END;
        END;
    \endif
    
    -- Si aucune option valide n'est sélectionnée
    \if :choix_invalide_bool
        \echo 'Aucune modification demandée (option invalide).'
    \endif
\else
    \echo 'Aucun produit trouvé, modification impossible.'
\endif
