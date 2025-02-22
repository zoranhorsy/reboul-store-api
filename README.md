# Reboul Store API

Backend API pour la boutique Reboul Store, construite avec Express.js et PostgreSQL.

## Configuration requise

- Node.js (v18 ou supérieur)
- PostgreSQL
- npm ou yarn

## Installation

1. Cloner le repository :
```bash
git clone https://github.com/zoranhorsy/reboul-store-api.git
cd reboul-store-api
```

2. Installer les dépendances :
```bash
npm install
```

3. Configurer les variables d'environnement :
```bash
cp .env.example .env
```
Puis modifiez le fichier `.env` avec vos propres valeurs.

4. Initialiser la base de données :
```bash
psql -U postgres -f init-db.sql
```

## Démarrage

Pour démarrer le serveur en mode développement :
```bash
npm run dev
```

Pour démarrer le serveur en mode production :
```bash
npm start
```

## Tests

Pour exécuter les tests :
```bash
npm test
```

## Structure du projet

- `/controllers` - Logique métier
- `/routes` - Définitions des routes API
- `/models` - Modèles de données
- `/middleware` - Middleware Express
- `/config` - Fichiers de configuration
- `/migrations` - Migrations de base de données
- `/tests` - Tests unitaires et d'intégration

## API Endpoints

- `GET /api/products` - Liste des produits
- `GET /api/products/:id` - Détails d'un produit
- `POST /api/products` - Créer un produit
- `PUT /api/products/:id` - Mettre à jour un produit
- `DELETE /api/products/:id` - Supprimer un produit

## Déploiement

Ce projet est configuré pour être déployé sur Railway.

## Licence

MIT 