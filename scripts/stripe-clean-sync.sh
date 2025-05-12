#!/bin/bash

# Script pour exécuter la synchronisation Stripe avec suppression complète des produits existants
# Utilisation: ./stripe-clean-sync.sh [nombre_max_produits]

# Aller au répertoire du script
cd "$(dirname "$0")"

# Afficher un avertissement en rouge
echo -e "\033[31m/!\ ATTENTION: Ce script va SUPPRIMER DÉFINITIVEMENT tous les produits existants de votre compte Stripe /!\ \033[0m"
echo -e "\033[31mCette action est IRRÉVERSIBLE et supprimera toutes les données produits de Stripe.\033[0m"
echo ""

# Demander confirmation
read -p "Êtes-vous sûr de vouloir continuer? (oui/non): " confirm
if [[ "$confirm" != "oui" ]]; then
  echo "Opération annulée."
  exit 1
fi

# Vérifier si un nombre maximum de produits est spécifié
if [ ! -z "$1" ]; then
  MAX_PRODUCTS=$1
else
  MAX_PRODUCTS=0 # 0 signifie tous les produits
fi

# Définir les variables d'environnement pour le script
export CLEAN_PRODUCTS=true
export MAX_PRODUCTS=$MAX_PRODUCTS

echo "Démarrage de la synchronisation avec suppression complète des produits Stripe..."
echo "Nombre maximum de produits à recréer: $MAX_PRODUCTS (0 = tous)"

# Exécuter le script de synchronisation
node stripe-product-sync.js

echo "Script terminé!" 