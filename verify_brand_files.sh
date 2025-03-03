#!/bin/bash

cd public/brands

# Liste des marques à vérifier
brands=(
    "AFTERLABEL"
    "APC"
    "ARTE"
    "ASPESI"
    "ATELIERDENIMES"
    "AUTRY"
    "AXELARIGATO"
    "BISOUSSKATEBOARDS"
    "CARHARTT"
    "CHLOE"
    "CPCOMPANY"
    "DOLCEGABBANA"
    "DOUCALS"
    "DSQUARED"
    "GCDS"
    "GIVENCHY"
    "GOLDENGOOSE"
    "HERNO"
    "HOLOGRAM"
    "JACOBCOHEN"
    "JONSEN"
    "K-WAY"
    "LANVIN"
    "LESDEUX"
    "MAISONLABICHE"
    "MANUELRITZ"
    "MARGIELA"
    "MARNI"
    "MC2"
    "MERCER"
    "MIZUNO"
    "MONCLER"
    "NEWBALANCE"
    "NORSEPROJECTS"
    "NUMERO21"
    "OFF-WHITE"
    "PALMANGELS"
    "PARAJUMPERS"
    "PATAGONIA"
    "PHILIPKARTO"
    "PHILIPPEMODEL"
    "PREMIATA"
    "PYRENEX"
    "RAINS"
    "RRD"
    "SALOMON"
    "SERAPHIN"
    "STONEISLAND"
    "TOPOLOGIE"
    "VEJA"
    "VILBREQUIN"
    "WHITESAND"
    "ZADIGVOLTAIRE"
)

# Vérifier chaque marque
for brand in "${brands[@]}"; do
    echo "Vérification de $brand..."
    
    # Créer le dossier s'il n'existe pas
    if [ ! -d "$brand" ]; then
        echo "Création du dossier $brand"
        mkdir -p "$brand"
    fi
    
    # Vérifier les fichiers
    if [ ! -f "$brand/${brand}_w.png" ]; then
        echo "ATTENTION: $brand/${brand}_w.png manquant"
    fi
    
    if [ ! -f "$brand/${brand}_b.png" ]; then
        echo "ATTENTION: $brand/${brand}_b.png manquant"
    fi
done 