-- Script de mise à jour des chaussures ASICS
-- Ajoute des caractéristiques et des tags spécifiques à chaque modèle ASICS

DO $$
DECLARE
    asics_brand_id INTEGER := 37; -- ID de la marque ASICS
    product_cursor CURSOR FOR 
        SELECT id, name FROM products 
        WHERE brand_id = asics_brand_id;
    product_rec RECORD;
    products_updated INTEGER := 0; -- Déplacé ici dans la section DECLARE
BEGIN

-- Afficher début d'exécution
RAISE NOTICE 'Début de la mise à jour des produits ASICS...';

-- Ouvrir le curseur pour parcourir tous les produits ASICS
OPEN product_cursor;

-- Pour chaque produit ASICS
LOOP
    -- Récupérer le produit suivant
    FETCH product_cursor INTO product_rec;
    
    -- Sortir de la boucle s'il n'y a plus de produits
    EXIT WHEN NOT FOUND;
    
    -- Déterminer le modèle en fonction du nom du produit
    IF product_rec.name ILIKE '%GEL 1130%' THEN
        -- Mise à jour pour ASICS GEL 1130
        UPDATE products
        SET 
            details = ARRAY[
                'ASICS GEL-1130 - Réédition du modèle iconique de 2008',
                'Technologie GEL™ visible dans le talon pour un amorti supérieur',
                'Tige en mesh technique et overlays en cuir synthétique',
                'Système TRUSSTIC™ sous le milieu du pied pour plus de stabilité',
                'Semelle intermédiaire en mousse EVA pour un amorti durable',
                'Style rétro-running modernisé pour un look urbain contemporain',
                'Semelle extérieure en caoutchouc AHAR® pour une adhérence optimale',
                'Poids approximatif: 320g (taille 42)'
            ],
            tags = ARRAY[
                'asics',
                'gel-1130',
                'retro runner',
                'y2k',
                'sneakers',
                'dad shoes',
                'heritage',
                'années 2000',
                'running',
                'chunky',
                'streetwear'
            ]
        WHERE id = product_rec.id;
        
    ELSIF product_rec.name ILIKE '%GEL KAYANO 14%' THEN
        -- Mise à jour pour ASICS GEL KAYANO 14
        UPDATE products
        SET 
            details = ARRAY[
                'ASICS GEL-KAYANO 14 - Réédition du modèle emblématique de 2008',
                'Double technologie d''amorti GEL™ à l''avant-pied et au talon',
                'Système Space Trusstic™ pour la stabilité et la transition fluide',
                'Tige complexe multi-matériaux avec construction asymétrique',
                'Technology IGS® (Impact Guidance System) pour une foulée naturelle',
                'Semelle intermédiaire SpEVA™ et Solyte™ pour rebond et légèreté',
                'Semelle extérieure à plaques AHAR+ pour durabilité exceptionnelle',
                'Modèle de stabilité running premium adapté au lifestyle',
                'Poids: 337g (taille 42)'
            ],
            tags = ARRAY[
                'asics',
                'gel-kayano 14',
                'premium',
                'collectionneurs',
                'cushion',
                'stability',
                'héritage',
                'running',
                'technique',
                'streetwear',
                'archive'
            ]
        WHERE id = product_rec.id;
        
    ELSIF product_rec.name ILIKE '%GEL KINETIC%' THEN
        -- Mise à jour pour ASICS GEL KINETIC OG
        UPDATE products
        SET 
            details = ARRAY[
                'ASICS GEL-KINETIC OG - Retour d''un modèle avant-gardiste des années 2000',
                'Technologie GEL™ visible sur toute la semelle pour un amorti maximal',
                'Concept "Kinetic" innovant avec semelle dynamique multi-couches',
                'Design futuriste caractéristique avec esthétique Y2K',
                'Tige en mesh respirant avec renforts stratégiques en TPU',
                'Semelle sculptée multi-densité pour un style distinctif',
                'Éléments réfléchissants pour visibilité nocturne',
                'Concept original développé pour les coureurs neutres cherchant un amorti maximal',
                'Poids: 345g (taille 42)'
            ],
            tags = ARRAY[
                'asics',
                'gel-kinetic',
                'og',
                'futuriste',
                'y2k',
                'cushion',
                'chunky',
                'maximaliste',
                'avant-garde',
                'millennial',
                'collection'
            ]
        WHERE id = product_rec.id;
        
    ELSIF product_rec.name ILIKE '%GEL NYC%' THEN
        -- Mise à jour pour ASICS GEL NYC
        UPDATE products
        SET 
            details = ARRAY[
                'ASICS GEL-NYC - Modèle hybride inspiré par l''architecture new-yorkaise',
                'Design unique fusionnant éléments de plusieurs modèles iconiques (GEL-NIMBUS™, GEL-CUMULUS™ et GEL-QUANTUM 360™)',
                'Technologie GEL™ visible pour un amorti optimal',
                'Construction multi-couches évoquant les gratte-ciels emblématiques',
                'Combinaison de suède premium, mesh technique et overlays texturés',
                'Semelle extérieure en caoutchouc multi-surface',
                'Conçu comme une déclaration urbaine et culturelle',
                'Collaboration du ASICS Design Studio avec des coloristes inspirés par NYC',
                'Poids: 338g (taille 42)'
            ],
            tags = ARRAY[
                'asics',
                'gel-nyc',
                'hybride',
                'architecture',
                'manhattan',
                'mélange',
                'urbain',
                'crossover',
                'exclusif',
                'design',
                'lifestyle'
            ]
        WHERE id = product_rec.id;
        
    ELSE
        -- Mise à jour par défaut pour les autres modèles ASICS
        UPDATE products
        SET 
            details = ARRAY[
                'Chaussure ASICS avec technologie GEL™ signature de la marque',
                'Conçue avec l''expertise running japonaise d''ASICS',
                'Équilibre parfait entre performance technique et esthétique lifestyle',
                'Amorti adapté pour un confort quotidien optimal',
                'Construction durable fidèle à la réputation de qualité ASICS',
                'Semelle en caoutchouc pour adhérence sur toutes les surfaces',
                'Design intemporel inspiré de l''héritage sportif de la marque'
            ],
            tags = ARRAY[
                'asics',
                'japanese',
                'tiger',
                'sportswear',
                'heritage',
                'running',
                'comfort',
                'quality',
                'gel',
                'sneakers',
                'performance'
            ]
        WHERE id = product_rec.id;
    END IF;
    
    RAISE NOTICE 'Produit ASICS "%" (ID: %) mis à jour avec succès', product_rec.name, product_rec.id;
    products_updated := products_updated + 1;
END LOOP;

-- Fermer le curseur
CLOSE product_cursor;

IF products_updated = 0 THEN
    RAISE NOTICE 'Aucun produit ASICS trouvé dans la base de données.';
ELSE
    RAISE NOTICE 'Mise à jour terminée. % produits ASICS ont été mis à jour avec succès', products_updated;
END IF;

END $$; 