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

**Champs par défaut retournés (sans spécifier fields):**
- id
- name
- price
- image_url
- brand
- brand_id
- store_type

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

## Bonnes Pratiques

1. **Toujours spécifier les champs nécessaires** avec le paramètre `fields` pour minimiser la taille des réponses
2. **Limiter le nombre d'éléments par page** à ce qui est nécessaire pour l'UI
3. **Utiliser les filtres côté serveur** plutôt que de filtrer côté client
4. **Mettre en cache les résultats** quand c'est possible

## Codes de Statut HTTP

- `200 OK`: Requête réussie
- `400 Bad Request`: Paramètres de requête invalides
- `401 Unauthorized`: Authentification requise
- `403 Forbidden`: Accès non autorisé
- `404 Not Found`: Ressource non trouvée
- `500 Internal Server Error`: Erreur serveur

## Performances

La structure de réponse optimisée permet généralement une réduction de taille de 30% à 70% par rapport à la version non optimisée, selon les champs sélectionnés. 