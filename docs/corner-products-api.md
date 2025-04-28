# API The Corner - Documentation

## Vue d'ensemble

L'API The Corner permet de gérer les produits de la boutique The Corner. Elle fournit des endpoints pour créer, lire, mettre à jour et supprimer des produits, ainsi que pour gérer leur stock.

## Base URL

```
https://reboul-store-api-production.up.railway.app/api/corner-products
```

## Authentification

La plupart des endpoints nécessitent une authentification via un token JWT. Le token doit être inclus dans le header `Authorization` :

```
Authorization: Bearer <votre_token>
```

## Endpoints

### Liste des produits

```http
GET /corner-products
```

Récupère une liste paginée des produits The Corner.

**Paramètres de requête :**
- `page` (optionnel) : Numéro de page (défaut: 1)
- `limit` (optionnel) : Nombre d'éléments par page (défaut: 50, max: 100)
- `category_id` (optionnel) : Filtrer par catégorie
- `brand_id` (optionnel) : Filtrer par marque
- `brand` (optionnel) : Filtrer par nom de marque
- `minPrice` (optionnel) : Prix minimum
- `maxPrice` (optionnel) : Prix maximum
- `featured` (optionnel) : Produits mis en avant (true/false)
- `inStock` (optionnel) : Produits en stock uniquement (true/false)
- `search` (optionnel) : Recherche par nom ou description
- `sort` (optionnel) : Tri par 'name' ou 'price'
- `order` (optionnel) : Ordre de tri 'asc' ou 'desc'

**Exemple de réponse :**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Produit Example",
      "description": "Description du produit",
      "price": "99.99",
      "variants": [
        {
          "color": "Noir",
          "size": "M",
          "stock": 10
        }
      ],
      // ... autres champs
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 50,
    "totalItems": 100,
    "totalPages": 2
  }
}
```

### Détails d'un produit

```http
GET /corner-products/:id
```

Récupère les détails d'un produit spécifique.

**Exemple de réponse :**
```json
{
  "id": 1,
  "name": "Produit Example",
  "description": "Description du produit",
  "price": "99.99",
  "variants": [...],
  "reviews": [...],
  // ... autres champs
}
```

### Créer un produit

```http
POST /corner-products
```

Crée un nouveau produit The Corner.

**Headers requis :**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data` (si upload d'images)

**Corps de la requête :**
```json
{
  "name": "Nouveau Produit",
  "description": "Description du produit",
  "price": 99.99,
  "old_price": 129.99,
  "category_id": 1,
  "brand_id": 1,
  "variants": [
    {
      "color": "Noir",
      "size": "M",
      "stock": 10
    }
  ],
  "featured": false,
  "new": true
}
```

### Mettre à jour un produit

```http
PUT /corner-products/:id
```

Met à jour un produit existant.

**Headers requis :**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data` (si upload d'images)

**Corps de la requête :**
```json
{
  "name": "Nom mis à jour",
  "price": 149.99,
  // ... autres champs à mettre à jour
}
```

### Mettre à jour le stock d'un variant

```http
PATCH /corner-products/:id/stock
```

Met à jour le stock d'un variant spécifique.

**Headers requis :**
- `Authorization: Bearer <token>`

**Corps de la requête :**
```json
{
  "color": "Noir",
  "size": "M",
  "quantity": 15
}
```

### Supprimer un produit

```http
DELETE /corner-products/:id
```

Supprime un produit. Effectue une suppression douce si le produit a des commandes associées.

**Headers requis :**
- `Authorization: Bearer <token>`

**Exemple de réponse (soft delete) :**
```json
{
  "message": "Produit The Corner supprimé avec succès",
  "product": {
    "id": 1,
    "active": false,
    // ... autres champs
  },
  "type": "soft_delete"
}
```

## Gestion des erreurs

L'API retourne des codes d'erreur HTTP appropriés avec des messages descriptifs :

- `400 Bad Request` : Requête invalide (validation échouée)
- `401 Unauthorized` : Token manquant ou invalide
- `403 Forbidden` : Permissions insuffisantes
- `404 Not Found` : Ressource non trouvée
- `500 Internal Server Error` : Erreur serveur

**Exemple de réponse d'erreur :**
```json
{
  "status": "error",
  "message": "Message d'erreur détaillé",
  "errors": [
    {
      "field": "price",
      "message": "Le prix doit être un nombre positif"
    }
  ]
}
```

## Modèles de données

### Produit The Corner

```typescript
{
  id: number;
  name: string;
  description?: string;
  price: number;
  old_price?: number;
  category_id?: number;
  brand_id?: number;
  brand?: string;
  image_url?: string;
  images?: string[];
  variants?: Variant[];
  tags?: string[];
  details?: string[];
  featured: boolean;
  active: boolean;
  new: boolean;
  sku?: string;
  store_reference?: string;
  material?: string;
  weight?: number;
  dimensions?: string;
  rating?: number;
  reviews_count: number;
  created_at: string;
  updated_at: string;
}
```

### Variant

```typescript
{
  color: string;
  size: string;
  stock: number;
}
``` 