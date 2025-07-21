-- Nettoyage des anciens produits sneakers et minots de la table products
-- Ces produits sont maintenant dans leurs tables dédiées

-- Vérifier d'abord quels produits on va supprimer
SELECT 
    'Avant suppression' as status,
    store_type, 
    COUNT(*) as count 
FROM products 
GROUP BY store_type;

-- Supprimer les produits sneakers (maintenant dans sneakers_products)
DELETE FROM products 
WHERE store_type = 'sneakers';

-- Supprimer les produits minots/kids (maintenant dans minots_products)
DELETE FROM products 
WHERE store_type = 'kids';

-- Vérifier le résultat
SELECT 
    'Après suppression' as status,
    store_type, 
    COUNT(*) as count 
FROM products 
GROUP BY store_type;

-- Afficher le résumé
SELECT 
    'Résumé final' as status,
    COUNT(*) as total_products_remaining
FROM products; 