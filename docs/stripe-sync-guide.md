# Guide d'Utilisation des Scripts de Synchronisation Stripe

Ce document détaille l'utilisation des scripts de synchronisation des produits entre la base de données Reboul et Stripe, nécessaires pour l'implémentation de Stripe Payment Links.

## Table des matières

1. [Présentation des scripts](#présentation-des-scripts)
2. [Configuration requise](#configuration-requise)
3. [Synchronisation manuelle des produits](#synchronisation-manuelle-des-produits)
4. [Configuration de la synchronisation automatique](#configuration-de-la-synchronisation-automatique)
5. [Utilisation de l'API d'administration](#utilisation-de-lapi-dadministration)
6. [Journalisation et résolution des problèmes](#journalisation-et-résolution-des-problèmes)

## Présentation des scripts

Trois scripts sont disponibles pour la gestion de la synchronisation des produits avec Stripe:

1. **stripe-product-sync.js**: Script principal qui synchronise les produits de la base de données vers Stripe
2. **setup-stripe-sync-cron.js**: Utilitaire pour configurer une tâche cron de synchronisation quotidienne
3. **Endpoint API**: Route d'administration pour déclencher la synchronisation manuellement via l'interface d'administration

## Configuration requise

### Prérequis

- Node.js >= 14
- Compte Stripe actif avec clés API configurées
- Variables d'environnement configurées:
  - `STRIPE_SECRET_KEY`: Clé API secrète Stripe
  - `STRIPE_WEBHOOK_SECRET`: Secret pour la vérification des webhooks (optionnel pour la synchronisation)

### Installation des dépendances

Si ce n'est pas déjà fait, installez les dépendances nécessaires:

```bash
cd backend
npm install stripe dotenv
```

## Synchronisation manuelle des produits

Pour lancer une synchronisation manuelle des produits depuis la ligne de commande:

```bash
cd backend
node scripts/stripe-product-sync.js
```

Ce script:
- Récupère tous les produits actifs de la base de données Reboul
- Crée ou met à jour les produits correspondants dans Stripe
- Gère les produits, variantes, prix et stocks
- Journalise les résultats dans le répertoire `logs/`

### Processus de synchronisation

1. Les produits sont récupérés par lots de 50 (configurable)
2. Pour chaque produit:
   - Vérification de l'existence dans Stripe via les métadonnées
   - Création ou mise à jour du produit
   - Gestion des prix (désactivation des anciens prix si nécessaire)
   - Traitement des variantes et de leurs prix

## Configuration de la synchronisation automatique

Pour configurer une synchronisation quotidienne automatique:

```bash
cd backend
node scripts/setup-stripe-sync-cron.js
```

Ce script:
- Configure une tâche cron qui s'exécute tous les jours à 2h du matin
- Vérifie si une tâche similaire existe déjà
- Crée un journal des synchronisations dans `logs/stripe-sync-cron.log`

Pour modifier la fréquence de synchronisation, éditez la variable `CRON_SCHEDULE` dans le script.

## Utilisation de l'API d'administration

L'API d'administration permet de déclencher une synchronisation depuis l'interface d'administration:

### Endpoint

```
POST /api/admin/stripe/sync-products
```

### Authentification

Requiert des droits d'administrateur. L'endpoint utilise le middleware `adminMiddleware` pour vérifier les permissions. Utilisez un token JWT valide dans l'en-tête d'autorisation:

```
Authorization: Bearer <votre_token_jwt>
```

### Exemple d'utilisation avec curl

```bash
curl -X POST \
  http://localhost:3000/api/admin/stripe/sync-products \
  -H 'Authorization: Bearer <votre_token_jwt>' \
  -H 'Content-Type: application/json'
```

### Réponse

```json
{
  "success": true,
  "message": "Synchronisation des produits avec Stripe démarrée en arrière-plan."
}
```

## Journalisation et résolution des problèmes

### Fichiers de journalisation

Les journaux de synchronisation sont stockés dans:

- **Synchronisation manuelle**: `backend/logs/stripe-sync-YYYY-MM-DD.log`
- **Synchronisation cron**: `backend/logs/stripe-sync-cron.log`

### Structure des journaux

Chaque entrée de journal inclut:
- Horodatage
- Type d'opération (INFO/ERROR)
- Message détaillé

### Problèmes courants

1. **Erreur d'authentification Stripe**
   - Vérifiez que `STRIPE_SECRET_KEY` est correctement configurée
   - Assurez-vous que la clé API est valide et active

2. **Produits manquants dans Stripe**
   - Vérifiez que les produits sont marqués comme actifs dans la base de données
   - Consultez les journaux pour identifier les erreurs spécifiques

3. **Erreurs de synchronisation des prix**
   - Vérifiez que les prix dans la base de données sont valides (non nuls, positifs)
   - Assurez-vous que la devise est configurée correctement (EUR par défaut)

### Exemple de journal

```
[2023-05-15T14:32:45.123Z] Démarrage de la synchronisation des produits avec Stripe...
[2023-05-15T14:32:46.789Z] 120 produits actifs trouvés dans la base de données
[2023-05-15T14:32:47.456Z] Traitement du lot 1/3 (50 produits)
[2023-05-15T14:32:48.123Z] Nouveau produit créé dans Stripe: Chaussures élégantes (ID: 45)
[2023-05-15T14:32:49.456Z] Nouveau prix créé: 129.99€ (Produit ID: 45)
[2023-05-15T14:32:50.789Z] ERROR: Erreur lors de la synchronisation du produit (ID: 46): Invalid price amount
```

---

Pour toute question ou assistance supplémentaire, contactez l'équipe technique de Reboul. 