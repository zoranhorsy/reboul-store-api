# Documentation API pour la Pagination Optimisée

## Structure de Réponse

L'API de Reboul E-commerce utilise une structure de réponse paginée optimisée afin de minimiser la taille des données transmises. Cette optimisation permet d'améliorer les performances du frontend et réduire la consommation de bande passante.

### Format de Réponse Standard

Toutes les API de liste utilisent le format suivant pour la pagination:

```json
{
  "data": [ ... ],  // Tableau d'objets (produits, commandes, etc.)
  "pagination": {
    "currentPage": 1,       // Page actuelle
    "pageSize": 10,         // Nombre d'éléments par page
    "totalItems": 100,      // Nombre total d'éléments
    "totalPages": 10        // Nombre total de pages
  }
}
```

## Optimisations de Taille de Données

### 1. Sélection de Champs Spécifiques

Pour réduire la taille des réponses, vous pouvez spécifier exactement quels champs vous souhaitez recevoir en utilisant le paramètre `fields`.

**Exemple:** Pour récupérer uniquement les ID, noms et prix des produits:

```
GET /api/products?fields=id,name,price
```

#### Produits standards (api/products)

**Champs disponibles pour les produits:**
- `id` - Identifiant unique du produit
- `name` - Nom du produit
- `description` - Description détaillée
- `price` - Prix du produit
- `category_id` - ID de la catégorie
- `brand` - Nom de la marque
- `brand_id` - ID de la marque
- `image_url` - URL de l'image principale
- `images` - Tableau des URLs d'images additionnelles
- `variants` - Tableau des variantes (tailles, couleurs, stock)
- `tags` - Tableau des tags associés
- `details` - Tableau des détails du produit
- `store_type` - Type de magasin (adult, kids, sneakers, cpcompany)
- `featured` - Produit mis en avant (boolean)
- `active` - Produit actif (boolean)
- `new` - Produit nouveau (boolean)
- `_actiontype` - Type d'action sur le produit
- `store_reference` - Référence du magasin
- `material` - Matériau du produit
- `weight` - Poids du produit
- `dimensions` - Dimensions du produit
- `rating` - Note moyenne du produit
- `reviews_count` - Nombre d'avis
- `created_at` - Date de création
- `sku` - Référence unique du produit

#### Produits The Corner (api/corner-products)

**Champs disponibles pour les produits Corner:**
- `id` - Identifiant unique du produit
- `name` - Nom du produit
- `description` - Description détaillée
- `price` - Prix actuel du produit
- `old_price` - Ancien prix (pour les promotions)
- `category_id` - ID de la catégorie
- `brand` - Nom de la marque
- `brand_id` - ID de la marque
- `image_url` - URL de l'image principale
- `images` - Tableau des URLs d'images additionnelles
- `variants` - Tableau des variantes (tailles, couleurs, stock)
- `tags` - Tableau des tags associés
- `details` - Tableau des détails du produit
- `featured` - Produit mis en avant (boolean)
- `active` - Produit actif (boolean)
- `new` - Produit nouveau (boolean)
- `sku` - Référence unique du produit
- `store_reference` - Référence du magasin
- `material` - Matériau du produit
- `weight` - Poids du produit
- `dimensions` - Dimensions du produit
- `rating` - Note moyenne du produit
- `reviews_count` - Nombre d'avis
- `created_at` - Date de création
- `updated_at` - Date de dernière mise à jour

**Par défaut, tous les champs sont retournés** sauf si vous spécifiez le paramètre `fields`.

**Avantages:**
- Réduit significativement la taille des réponses
- Améliore les temps de réponse de l'API
- Diminue l'utilisation de bande passante
- Accélère le parsing JSON côté client

### 2. Compression HTTP

Toutes les réponses API sont automatiquement compressées avec GZIP/Deflate lorsque le client le supporte. Cela réduit significativement la taille des données transmises sur le réseau.

Pour désactiver la compression dans un cas spécifique (rare), vous pouvez ajouter l'en-tête `x-no-compression: true` à votre requête.

### 3. Pagination Optimisée

La pagination est configurée avec les paramètres suivants:

- `page`: Numéro de page (commence à 1)
- `limit`: Nombre d'éléments par page (maximum 100)

**Exemple:**
```
GET /api/products?page=2&limit=20
```

## Exemples d'Utilisation

### 1. Liste de produits basique

```
GET /api/products?page=1&limit=10
```

### 2. Liste de produits avec champs spécifiques

```
GET /api/products?page=1&limit=10&fields=id,name,price,image_url
```

### 3. Recherche de produits avec filtres et champs spécifiques

```
GET /api/products?search=sneakers&category_id=5&fields=id,name,price,image_url,variants
```

### 4. Obtenir uniquement les informations de variants

```
GET /api/products?fields=id,name,variants
```

### 5. Liste de produits The Corner avec pagination

```
GET /api/corner-products?page=1&limit=10
```

### 6. Liste de produits The Corner avec champs spécifiques

```
GET /api/corner-products?fields=id,name,price,old_price,image_url,variants
```

## Bonnes Pratiques

1. **Pour les vues catalogue**: Utilisez uniquement les champs nécessaires à l'affichage des vignettes:
   ```
   fields=id,name,price,image_url,variants,brand,featured,new
   ```

2. **Pour les pages produit**: Récupérez tous les détails:
   ```
   fields=id,name,price,description,image_url,images,variants,brand,tags,details,material,dimensions
   ```

3. **Pour The Corner**: Pour les vues catalogue:
   ```
   fields=id,name,price,old_price,image_url,variants,brand,featured,new
   ```

4. **Limiter le nombre d'éléments par page** à ce qui est nécessaire pour l'UI
5. **Utiliser les filtres côté serveur** plutôt que de filtrer côté client
6. **Mettre en cache les résultats** quand c'est possible

## Codes de Statut HTTP

- `200 OK`: Requête réussie
- `400 Bad Request`: Paramètres de requête invalides
- `401 Unauthorized`: Authentification requise
- `403 Forbidden`: Accès non autorisé
- `404 Not Found`: Ressource non trouvée
- `500 Internal Server Error`: Erreur serveur

## Performances

La structure de réponse optimisée permet généralement une réduction de taille de 30% à 70% par rapport à la version non optimisée, selon les champs sélectionnés. Pour les vues catalogue, nous recommandons de limiter les champs aux informations essentielles afin d'optimiser les performances. 