# Backend Reboul

Ce dossier contient le code backend de l'application Reboul.

## Structure

- `api/` : Points d'entrée de l'API
- `config/` : Configuration du serveur
- `models/` : Modèles de données
- `services/` : Logique métier
- `utils/` : Fonctions utilitaires

## Configuration

1. Assurez-vous d'avoir les variables d'environnement nécessaires dans un fichier `.env`
2. Installez les dépendances avec `npm install`
3. Lancez le serveur en mode développement avec `npm run dev`

## API Endpoints

Les endpoints de l'API sont documentés dans le dossier `api/`. Chaque endpoint suit la convention REST.

## Base de données

Le backend utilise une base de données PostgreSQL. Les migrations et les schémas sont gérés avec Prisma.

## Tests

Pour exécuter les tests :
```bash
npm run test
```

Pour les tests en mode watch :
```bash
npm run test:watch
```

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