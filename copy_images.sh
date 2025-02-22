#!/bin/bash

# Définir les chemins
FRONTEND_DIR="../public"
BACKEND_DIR="public"

# Créer les dossiers nécessaires
mkdir -p "$BACKEND_DIR/brands"
mkdir -p "$BACKEND_DIR/uploads"
mkdir -p "$BACKEND_DIR/archives"

# Copier les images des marques
echo "Copie des images des marques..."
cp -r "$FRONTEND_DIR/brands"/* "$BACKEND_DIR/brands/"

# Copier les autres images statiques
echo "Copie des autres images statiques..."
cp "$FRONTEND_DIR/placeholder.png" "$BACKEND_DIR/"
cp "$FRONTEND_DIR/pattern.png" "$BACKEND_DIR/"

# Afficher la structure des dossiers
echo "Structure des dossiers :"
ls -R "$BACKEND_DIR"

# Ajouter les fichiers au Git
echo "Ajout des fichiers à Git..."
git add public/
git status 