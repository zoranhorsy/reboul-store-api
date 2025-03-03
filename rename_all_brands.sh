#!/bin/bash

cd backend/public/brands

# 1. D'abord renommer les dossiers
echo "=== Renommage des dossiers ==="
mv "AFTER LABEL" "AFTERLABEL" 2>/dev/null || true
mv "ATELIER DE NIMES" "ATELIERDENIMES" 2>/dev/null || true
mv "AXEL ARIGATO" "AXELARIGATO" 2>/dev/null || true
mv "BISOUS SKATEBOARDS" "BISOUSSKATEBOARDS" 2>/dev/null || true
mv "CP COMPANY" "CPCOMPANY" 2>/dev/null || true
mv "DOLCE & GABBANA" "DOLCEGABBANA" 2>/dev/null || true
mv "GOLDEN GOOSE" "GOLDENGOOSE" 2>/dev/null || true
mv "MAISON LABICHE" "MAISONLABICHE" 2>/dev/null || true
mv "NEW BALANCE" "NEWBALANCE" 2>/dev/null || true
mv "NORSE PROJECTS" "NORSEPROJECTS" 2>/dev/null || true
mv "PALM ANGELS" "PALMANGELS" 2>/dev/null || true
mv "PHILIP KARTO" "PHILIPKARTO" 2>/dev/null || true
mv "PHILIPPE MODEL" "PHILIPPEMODEL" 2>/dev/null || true
mv "STONE ISLAND" "STONEISLAND" 2>/dev/null || true
mv "WHITE SAND" "WHITESAND" 2>/dev/null || true
mv "ZADIG & VOLTAIRE" "ZADIGVOLTAIRE" 2>/dev/null || true

# 2. Ensuite renommer les fichiers dans chaque dossier
echo -e "\n=== Renommage des fichiers ==="

# Fonction pour renommer les fichiers d'un dossier
rename_brand_files() {
    local brand_dir=$1
    local brand_name=$(basename "$brand_dir")
    echo "Processing $brand_name..."
    
    cd "$brand_dir"
    
    # Renommer les fichiers en blanc (white/light)
    for f in *bianco*.png *white*.png *light*.png *w-*.png *-w.png *logo-bianco*.png; do
        if [ -f "$f" ]; then
            mv "$f" "${brand_name}_w.png"
            echo "Renamed $f to ${brand_name}_w.png"
        fi
    done
    
    # Renommer les fichiers en noir (black/dark)
    for f in *nero*.png *black*.png *dark*.png *b-*.png *-b.png *_b.png; do
        if [ -f "$f" ]; then
            mv "$f" "${brand_name}_b.png"
            echo "Renamed $f to ${brand_name}_b.png"
        fi
    done
    
    cd ..
}

# Parcourir tous les dossiers de marques
for brand_dir in */; do
    rename_brand_files "${brand_dir%/}"
done

echo -e "\nOpération terminée avec succès" 