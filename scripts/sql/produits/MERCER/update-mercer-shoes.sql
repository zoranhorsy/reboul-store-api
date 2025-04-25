-- ============================================================================
-- Nom du script : update-mercer-shoes.sql
-- Description : Script de modification des chaussures Mercer dans la base de données
-- Auteur : Équipe de développement
-- Date de création : 2023
-- Dernière modification : 2023-11-26
-- 
-- Utilisation : Ce script peut être exécuté directement dans votre SGBD
-- Pour modifier les valeurs de mise à jour, changez les variables au début du script
-- ============================================================================

-- Script de modification des chaussures Mercer
-- À exécuter directement dans la base de données

-- Variables de configuration
DO $$
DECLARE
    -- Configuration principale - NE PAS MODIFIER
    mercer_brand_id INTEGER := 32;
    current_date TIMESTAMP := NOW();
    
    -- Variables pour les modifications - À PERSONALISER SELON VOS BESOINS
    -- ===================================================================
    
    -- SECTION 1: PRIX
    -- Pour modifier les prix, décommentez et ajustez la ligne suivante:
    -- new_price_factor NUMERIC := 1.0; -- 1.0 = pas de changement, 1.1 = +10%, 0.9 = -10%
    
    -- SECTION 2: DESCRIPTIONS
    -- Pour modifier les descriptions, décommentez et ajustez la ligne suivante:
    -- new_description TEXT := 'Votre nouvelle description ici';
    
    -- SECTION 3: TAGS
    -- Pour modifier les tags, décommentez et ajustez la ligne suivante:
    -- new_tags TEXT[] := ARRAY['tag1', 'tag2', 'tag3', 'tag4'];
    
    -- SECTION 4: DÉTAILS PRODUITS
    -- Pour modifier les détails, décommentez et ajustez la ligne suivante:
    -- new_details TEXT[] := ARRAY['Détail 1', 'Détail 2', 'Détail 3', 'Détail 4'];
    
    -- SECTION 5: VARIANTS ET STOCK
    -- Pour modifier les stocks, décommentez et ajustez les lignes suivantes:
    -- stock_adjustment_size_40 INTEGER := 0; -- Ajustement pour taille 40
    -- stock_adjustment_size_41 INTEGER := 0; -- Ajustement pour taille 41
    -- stock_adjustment_size_42 INTEGER := 0; -- Ajustement pour taille 42
    
    -- SECTION 6: AJOUT DE NOUVELLES TAILLES
    -- Pour ajouter une nouvelle taille, décommentez et ajustez les lignes suivantes:
    -- add_new_size BOOLEAN := false; -- Mettre à true pour ajouter une nouvelle taille
    -- new_size TEXT := '43'; -- Nouvelle taille à ajouter
    -- new_size_stock INTEGER := 10; -- Stock initial pour la nouvelle taille
    
    -- Compteurs - NE PAS MODIFIER
    nb_produits_modifies INTEGER := 0;
    
BEGIN
    RAISE NOTICE 'Début de la modification des chaussures Mercer';

    -- 1. MISE À JOUR DES PRIX
    -- Décommentez le bloc suivant pour activer la mise à jour des prix
    /*
    UPDATE products
    SET price = price * new_price_factor
    WHERE brand_id = mercer_brand_id;
    
    GET DIAGNOSTICS nb_produits_modifies = ROW_COUNT;
    RAISE NOTICE 'Prix mis à jour pour % produits', nb_produits_modifies;
    */
    
    -- 2. MISE À JOUR DES DESCRIPTIONS
    -- Décommentez le bloc suivant pour activer la mise à jour des descriptions
    /*
    UPDATE products
    SET description = new_description
    WHERE brand_id = mercer_brand_id;
    
    GET DIAGNOSTICS nb_produits_modifies = ROW_COUNT;
    RAISE NOTICE 'Descriptions mises à jour pour % produits', nb_produits_modifies;
    */
    
    -- 3. MISE À JOUR DU STATUT "NEW"
    -- Décommentez le bloc suivant pour désactiver le statut "new" sur les produits anciens
    /*
    UPDATE products
    SET new = false
    WHERE brand_id = mercer_brand_id
    AND created_at < (current_date - INTERVAL '3 months');
    
    GET DIAGNOSTICS nb_produits_modifies = ROW_COUNT;
    RAISE NOTICE 'Statut "new" mis à jour pour % produits', nb_produits_modifies;
    */
    
    -- 4. MISE À JOUR DES TAGS
    -- Décommentez le bloc suivant pour activer la mise à jour des tags
    /*
    UPDATE products
    SET tags = new_tags
    WHERE brand_id = mercer_brand_id;
    
    GET DIAGNOSTICS nb_produits_modifies = ROW_COUNT;
    RAISE NOTICE 'Tags mis à jour pour % produits', nb_produits_modifies;
    */
    
    -- 5. MISE À JOUR DES DÉTAILS
    -- Décommentez le bloc suivant pour activer la mise à jour des détails
    /*
    UPDATE products
    SET details = new_details
    WHERE brand_id = mercer_brand_id;
    
    GET DIAGNOSTICS nb_produits_modifies = ROW_COUNT;
    RAISE NOTICE 'Détails mis à jour pour % produits', nb_produits_modifies;
    */
    
    -- 6. MISE À JOUR DES STOCKS (VARIANTS)
    -- Décommentez le bloc suivant pour activer la mise à jour des stocks
    /*
    UPDATE products
    SET variants = (
        SELECT jsonb_agg(
            CASE 
                WHEN elem->>'size' = '40' THEN 
                    jsonb_set(elem, '{stock}', to_jsonb((elem->>'stock')::integer + stock_adjustment_size_40))
                WHEN elem->>'size' = '41' THEN 
                    jsonb_set(elem, '{stock}', to_jsonb((elem->>'stock')::integer + stock_adjustment_size_41))
                WHEN elem->>'size' = '42' THEN 
                    jsonb_set(elem, '{stock}', to_jsonb((elem->>'stock')::integer + stock_adjustment_size_42))
                ELSE elem
            END
        )
        FROM jsonb_array_elements(variants) AS elem
    )
    WHERE brand_id = mercer_brand_id;
    
    GET DIAGNOSTICS nb_produits_modifies = ROW_COUNT;
    RAISE NOTICE 'Stocks mis à jour pour % produits', nb_produits_modifies;
    */
    
    -- 7. AJOUT D'UNE NOUVELLE TAILLE
    -- Décommentez le bloc suivant pour activer l'ajout d'une nouvelle taille
    /*
    IF add_new_size THEN
        UPDATE products p
        SET variants = variants || 
                      jsonb_build_array(
                          jsonb_build_object(
                              'color', (SELECT elem->>'color' FROM jsonb_array_elements(p.variants) AS elem LIMIT 1),
                              'size', new_size, 
                              'stock', new_size_stock
                          )
                      )
        WHERE brand_id = mercer_brand_id;
        
        GET DIAGNOSTICS nb_produits_modifies = ROW_COUNT;
        RAISE NOTICE 'Nouvelle taille % ajoutée pour % produits', new_size, nb_produits_modifies;
    END IF;
    */
    
    -- 8. MODIFICATION DES NOMS (exemple)
    -- Décommentez et personnalisez pour mettre à jour les noms de produits
    /*
    UPDATE products
    SET name = REPLACE(name, 'Mercer', 'Mercer Premium Homme')
    WHERE brand_id = mercer_brand_id;
    
    GET DIAGNOSTICS nb_produits_modifies = ROW_COUNT;
    RAISE NOTICE 'Noms mis à jour pour % produits', nb_produits_modifies;
    */
    
    -- 9. RECHERCHE DE PRODUITS PAR RÉFÉRENCE
    -- Décommentez et personnalisez pour rechercher des produits par référence
    -- Cette partie ne modifie rien, elle affiche seulement les résultats
    /*
    -- Option 1: Recherche par référence exacte
    RAISE NOTICE '--- Recherche par référence exacte ---';
    DO $inner$
    DECLARE
        ref_recherchee TEXT := 'MRC1'; -- Changez cette valeur pour la référence à rechercher
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT id, name, price, store_reference, sku 
            FROM products 
            WHERE store_reference = ref_recherchee
            AND brand_id = mercer_brand_id
        ) LOOP
            RAISE NOTICE 'Produit trouvé - ID: %, Nom: %, Prix: %, Référence: %, SKU: %', 
                r.id, r.name, r.price, r.store_reference, r.sku;
        END LOOP;
    END $inner$;
    
    -- Option 2: Recherche par correspondance partielle (utilise LIKE)
    RAISE NOTICE '--- Recherche par correspondance partielle ---';
    DO $inner$
    DECLARE
        motif_recherche TEXT := 'MRC%'; -- Exemple: 'MRC%' trouve toutes les références commençant par MRC
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT id, name, price, store_reference, sku 
            FROM products 
            WHERE store_reference LIKE motif_recherche
            AND brand_id = mercer_brand_id
        ) LOOP
            RAISE NOTICE 'Produit trouvé - ID: %, Nom: %, Prix: %, Référence: %, SKU: %', 
                r.id, r.name, r.price, r.store_reference, r.sku;
        END LOOP;
    END $inner$;
    */
    
    -- Confirmer les modifications
    SELECT COUNT(*) INTO nb_produits_modifies FROM products WHERE brand_id = mercer_brand_id;
    RAISE NOTICE 'Nombre total de produits Mercer: %', nb_produits_modifies;
    RAISE NOTICE 'Fin du script de modification';

END $$;