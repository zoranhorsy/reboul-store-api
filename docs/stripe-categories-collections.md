# Organisation des Catégories et Collections Stripe - Reboul E-commerce

## Introduction

Ce document explique la structure et l'organisation des produits dans Stripe pour l'application Reboul E-commerce. Cette organisation facilite la gestion du catalogue produits dans Stripe et améliore l'expérience d'achat des clients.

## Structure des Métadonnées Produits

Chaque produit dans Stripe contient les métadonnées suivantes pour son organisation:

### Catégorisation
- **category**: Catégorie principale du produit (ex: "Chaussures", "Vêtements", "Accessoires")
- **category_full**: Hiérarchie complète de la catégorie (ex: "Hommes > Chaussures")
- **collection**: Collection à laquelle appartient le produit (ex: "Nouveautés", "Produits Vedettes", "Promotions", "The Corner", "Standard")

### Attributs
- **brand**: Marque du produit
- **is_new**: Indique si le produit est nouveau ("true" ou "false")
- **is_featured**: Indique si le produit est en vedette ("true" ou "false")
- **has_discount**: Indique si le produit est en promotion ("true" ou "false")
- **store_type**: Type de magasin ("adult", "kids", "sneakers", "cpcompany")

### Références
- **product_type**: Type de produit dans la base de données ("regular" ou "corner")
- **original_id**: ID original du produit dans la base de données
- **db_product_id**: Identifiant unique complet du produit (format: "product_type_id")

## Collections Automatiques

Les produits sont automatiquement assignés aux collections suivantes:

1. **Nouveautés**: Produits marqués comme "new" dans la base de données
2. **Produits Vedettes**: Produits marqués comme "featured" dans la base de données
3. **Promotions**: Produits avec un ancien prix (old_price) supérieur au prix actuel
4. **The Corner**: Tous les produits provenant de la table "corner_products"
5. **Standard**: Tous les autres produits

## Hiérarchie des Catégories

La catégorisation reflète la structure hiérarchique de la base de données:

1. **Niveau supérieur**: Catégories parentes (ex: "Hommes", "Femmes", "Enfants")
2. **Sous-catégorie**: Catégories enfants (ex: "Chaussures", "T-shirts", "Accessoires")

Cette hiérarchie est représentée dans le champ `category_full` au format "Parent > Enfant".

## Utilisation dans Stripe

### Filtrage et Recherche
- Utilisez `metadata['category']:'Chaussures'` dans les recherches Stripe pour filtrer par catégorie
- Utilisez `metadata['collection']:'Nouveautés'` pour filtrer par collection

### Organisation du Catalogue
- Créez des sections dans Stripe Checkout basées sur les collections
- Organisez les rapports de vente par catégorie ou collection

## Synchronisation

La synchronisation des catégories et collections est automatique via le script `stripe-product-sync.js`. Lors de chaque synchronisation:

1. Les métadonnées sont mises à jour selon les données actuelles de la base de données
2. Les collections sont recalculées en fonction des attributs du produit
3. La hiérarchie des catégories est régénérée

## Recommendations

Pour une gestion optimale du catalogue Stripe:

1. Maintenez à jour les attributs `featured`, `new` et les prix dans la base de données
2. Assurez-vous que tous les produits ont une catégorie assignée
3. Exécutez la synchronisation régulièrement pour maintenir la cohérence
4. Utilisez les métadonnées pour créer des rapports et analyses de ventes

## Exemples d'Utilisation

### Filtrage de Produits dans l'API Stripe
```javascript
// Rechercher tous les produits de la collection "Nouveautés"
const nouveautes = await stripe.products.search({
  query: "metadata['collection']:'Nouveautés'",
});

// Rechercher tous les produits de la catégorie "Chaussures"
const chaussures = await stripe.products.search({
  query: "metadata['category']:'Chaussures'",
});

// Rechercher les produits en promotion de la marque "Axel Arigato"
const promotionsAxelArigato = await stripe.products.search({
  query: "metadata['has_discount']:'true' AND metadata['brand']:'Axel Arigato'",
});
```

### Création de Collections Personnalisées
```javascript
// Pour créer une collection saisonnière, vous pouvez ajouter manuellement 
// une métadonnée supplémentaire aux produits concernés:
await stripe.products.update('prod_XYZ123', {
  metadata: {
    seasonal_collection: 'Été 2023'
  }
});
``` 