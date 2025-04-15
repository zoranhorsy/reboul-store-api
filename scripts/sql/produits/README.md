# Scripts SQL pour la gestion des produits

Ce dossier contient des scripts SQL pour gérer les produits dans la base de données.

## Organisation

Les scripts sont organisés pour faciliter la maintenance et l'évolution de la base de données :

- `add-*.sql` : Scripts d'ajout de nouveaux produits
- `update-*.sql` : Scripts de mise à jour de produits existants
- `delete-*.sql` : Scripts de suppression de produits

## Utilisation

### Exécution directe dans un outil SQL

Vous pouvez exécuter ces scripts directement dans votre outil de gestion SQL (pgAdmin, DBeaver, etc.) ou via psql :

```bash
psql -h votre_hote -U votre_utilisateur -d votre_base -f backend/scripts/sql/produits/add-mercer-shoes.sql
```

### Avec Railway

Si votre base de données est hébergée sur Railway :

1. Allez dans le dashboard Railway
2. Sélectionnez votre projet et votre base de données
3. Ouvrez la section "SQL" ou "Query"
4. Copiez-collez le contenu du script SQL
5. Exécutez le script

## Modification des scripts

Pour modifier le nombre de produits ou d'autres paramètres, vous pouvez :

1. Ouvrir le script dans un éditeur de texte
2. Modifier les variables au début du script (sous la section `DECLARE`)
3. Sauvegarder et exécuter

## Liste des scripts disponibles

- `add-mercer-shoes.sql` - Ajoute des chaussures de la marque Mercer
- `update-asics-products.sql` - Met à jour les produits Asics

## Bonnes pratiques

- Toujours utiliser des transactions pour éviter les insertions partielles
- Documenter les changements dans les en-têtes des scripts
- Utiliser des variables pour les valeurs qui pourraient changer
- Ajouter des messages de log avec RAISE NOTICE pour suivre l'exécution 