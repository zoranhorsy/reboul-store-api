#!/bin/bash

# Script de suppression rapide pour Reboul
# Usage: ./quick_delete.sh [sneakers|minots|adult|all]

case $1 in
  "sneakers")
    echo "🗑️  Suppression de TOUS les sneakers..."
    echo "DELETE FROM order_items WHERE product_id IN (SELECT id FROM sneakers_products); DELETE FROM sneakers_variants WHERE product_id IN (SELECT id FROM sneakers_products); DELETE FROM sneakers_products;" | railway run psql
    echo "✅ Tous les sneakers supprimés !"
    ;;
    
  "minots")
    echo "🗑️  Suppression de TOUS les minots..."
    echo "DELETE FROM order_items WHERE product_id IN (SELECT id FROM minots_products); DELETE FROM minots_variants WHERE product_id IN (SELECT id FROM minots_products); DELETE FROM minots_products;" | railway run psql
    echo "✅ Tous les minots supprimés !"
    ;;
    
  "adult")
    echo "🗑️  Suppression de TOUS les produits adultes..."
    echo "DELETE FROM order_items WHERE product_id IN (SELECT id FROM products WHERE store_type = 'adult'); DELETE FROM products WHERE store_type = 'adult';" | railway run psql
    echo "✅ Tous les produits adultes supprimés !"
    ;;
    
  "all")
    echo "🚨 ATTENTION: Suppression de TOUS LES PRODUITS REBOUL !"
    echo "Continuer ? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
      echo "DELETE FROM order_items WHERE product_id IN (SELECT id FROM sneakers_products); DELETE FROM sneakers_variants WHERE product_id IN (SELECT id FROM sneakers_products); DELETE FROM sneakers_products; DELETE FROM order_items WHERE product_id IN (SELECT id FROM minots_products); DELETE FROM minots_variants WHERE product_id IN (SELECT id FROM minots_products); DELETE FROM minots_products; DELETE FROM order_items WHERE product_id IN (SELECT id FROM products WHERE store_type = 'adult'); DELETE FROM products WHERE store_type = 'adult';" | railway run psql
      echo "💥 TOUT supprimé !"
    else
      echo "❌ Suppression annulée."
    fi
    ;;
    
  *)
    echo "Usage: $0 [sneakers|minots|adult|all]"
    echo ""
    echo "Exemples:"
    echo "  $0 sneakers    # Supprime tous les sneakers"
    echo "  $0 minots      # Supprime tous les minots"
    echo "  $0 adult       # Supprime tous les produits adultes"
    echo "  $0 all         # Supprime TOUT (avec confirmation)"
    ;;
esac 