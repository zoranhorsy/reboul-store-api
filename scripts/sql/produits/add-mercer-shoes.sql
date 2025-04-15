-- ============================================================================
-- Nom du script : add-mercer-shoes.sql
-- Description : Script d'insertion de chaussures Mercer dans la base de données
-- Auteur : Équipe de développement
-- Date de création : 2023
-- Dernière modification : 2023-11-26
-- 
-- Utilisation : Ce script peut être exécuté directement dans votre SGBD
-- Pour modifier le nombre de produits à insérer, changez UNIQUEMENT 
-- la variable 'nombre_produits' au début du script
-- ============================================================================

-- Script d'insertion de chaussures Mercer
-- À exécuter directement dans la base de données

-- Variables de configuration
DO $$
DECLARE
    -- Configuration principale
    mercer_brand_id INTEGER := 32;
    shoes_category_id INTEGER := 20;
    current_date TIMESTAMP := NOW();
    product_id INTEGER;
    
    -- IMPORTANT: Nombre de produits à insérer (modifiable selon besoin)
    -- Changez uniquement cette valeur pour ajuster le nombre de produits
    nombre_produits INTEGER := 9;
    
    -- Nombre maximum de modèles disponibles
    max_modeles INTEGER := 10;
    
    -- Nombre effectif de produits à insérer (ne pas modifier cette variable)
    nb_produits INTEGER;
    
    -- Variables pour les modèles
    model_names TEXT[] := ARRAY[
        'Amsterdam', 'Berlin', 'Copenhagen', 'Dublin', 'Edinburgh',
        'Florence', 'Geneva', 'Helsinki', 'Istanbul', 'Lisbon'
    ];
    model_prices NUMERIC[] := ARRAY[
        165.00, 195.00, 175.00, 185.00, 170.00,
        205.00, 190.00, 180.00, 200.00, 175.00
    ];
    model_skus TEXT[] := ARRAY[
        'MERCER-AMS-1', 'MERCER-BER-2', 'MERCER-COP-3', 'MERCER-DUB-4', 'MERCER-EDI-5',
        'MERCER-FLO-6', 'MERCER-GEN-7', 'MERCER-HEL-8', 'MERCER-IST-9', 'MERCER-LIS-10'
    ];
    model_refs TEXT[] := ARRAY[
        'MRC1', 'MRC2', 'MRC3', 'MRC4', 'MRC5',
        'MRC6', 'MRC7', 'MRC8', 'MRC9', 'MRC10'
    ];
    model_featured BOOLEAN[] := ARRAY[
        true, false, true, false, true,
        false, false, true, false, true
    ];
    
    i INTEGER;
    model_name TEXT;
    model_price NUMERIC;
    model_sku TEXT;
    model_ref TEXT;
    is_featured BOOLEAN;
BEGIN
    -- Détermination du nombre de produits à insérer
    nb_produits := LEAST(nombre_produits, max_modeles);
    
    RAISE NOTICE 'Début de l''insertion de % chaussures Mercer', nb_produits;

    -- Boucle pour insérer les produits
    FOR i IN 1..nb_produits LOOP
        model_name := 'Mercer ' || model_names[i];
        model_price := model_prices[i];
        model_sku := model_skus[i];
        model_ref := model_refs[i];
        is_featured := model_featured[i];
        
        -- Description générique basée sur le modèle
        -- Les descriptions alternent entre 3 modèles différents
        
        INSERT INTO products (
            name, description, price, category_id, brand_id, 
            image_url, store_type, featured, active, new, 
            sku, store_reference, created_at,
            variants, tags, details
        ) VALUES (
            model_name,
            CASE i % 3
                WHEN 1 THEN 'Chaussures élégantes et confortables conçues pour la vie quotidienne. Fabriquées avec des matériaux premium pour une durabilité exceptionnelle.'
                WHEN 2 THEN 'Ces baskets tendance associent style et confort. Idéales pour un look urbain sophistiqué.'
                ELSE 'Ces chaussures polyvalentes s''adaptent à toutes les occasions, des rendez-vous professionnels aux sorties décontractées.'
            END,
            model_price, 
            shoes_category_id, 
            mercer_brand_id,
            NULL,
            'adult',
            is_featured,
            true,
            true,
            model_sku,
            model_ref,
            current_date,
            jsonb_build_array(
                jsonb_build_object('color', CASE i % 5 
                                WHEN 0 THEN 'Noir'
                                WHEN 1 THEN 'Blanc'
                                WHEN 2 THEN 'Gris'
                                WHEN 3 THEN 'Bleu'
                                ELSE 'Rouge'
                            END, 'size', '40', 'stock', 10),
                jsonb_build_object('color', CASE i % 5 
                                WHEN 0 THEN 'Noir'
                                WHEN 1 THEN 'Blanc'
                                WHEN 2 THEN 'Gris'
                                WHEN 3 THEN 'Bleu'
                                ELSE 'Rouge'
                            END, 'size', '41', 'stock', 8),
                jsonb_build_object('color', CASE i % 5 
                                WHEN 0 THEN 'Noir'
                                WHEN 1 THEN 'Blanc'
                                WHEN 2 THEN 'Gris'
                                WHEN 3 THEN 'Bleu'
                                ELSE 'Rouge'
                            END, 'size', '42', 'stock', 12)
            ),
            ARRAY['chaussures', 'sneakers', 'mercer', lower(model_names[i])],
            ARRAY['Matériau extérieur: Cuir/Textile', 'Semelle: Caoutchouc', 'Fabriqué en Europe', 'Référence: MRC-1' || LPAD(i::TEXT, 3, '0')]
        ) RETURNING id INTO product_id;
        
        RAISE NOTICE 'Produit % inséré: %', i, model_name;
    END LOOP;

    -- Confirmer les insertions
    RAISE NOTICE 'Insertion de % chaussures Mercer effectuée avec succès', nb_produits;

END $$; 