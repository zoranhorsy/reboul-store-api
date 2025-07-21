-- Désactiver les anciens produits sneakers et minots de la table products
-- Ces produits sont maintenant dans leurs tables dédiées
-- On les marque comme inactifs au lieu de les supprimer pour préserver les références

-- Vérifier d'abord quels produits on va désactiver
SELECT 
    'Avant désactivation' as status,
    store_type, 
    COUNT(*) as count,
    COUNT(CASE WHEN active = true THEN 1 END) as active_count
FROM products 
GROUP BY store_type;

-- Désactiver les produits sneakers (maintenant dans sneakers_products)
UPDATE products 
SET active = false
WHERE store_type = 'sneakers' AND active = true;

-- Désactiver les produits minots/kids (maintenant dans minots_products)
UPDATE products 
SET active = false
WHERE store_type = 'kids' AND active = true;

-- Vérifier le résultat
SELECT 
    'Après désactivation' as status,
    store_type, 
    COUNT(*) as count,
    COUNT(CASE WHEN active = true THEN 1 END) as active_count
FROM products 
GROUP BY store_type;

-- Afficher le résumé
SELECT 
    'Résumé final' as status,
    COUNT(*) as total_products,
    COUNT(CASE WHEN active = true THEN 1 END) as active_products
FROM products; 