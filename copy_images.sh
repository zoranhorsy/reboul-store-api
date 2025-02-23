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
if [ -d "$FRONTEND_DIR/brands" ]; then
    cp -r "$FRONTEND_DIR/brands"/* "$BACKEND_DIR/brands/" 2>/dev/null || true
    echo "Images des marques copiées"
else
    echo "Dossier des marques non trouvé dans le frontend"
fi

# Copier les autres images statiques
echo "Copie des autres images statiques..."
if [ -f "$FRONTEND_DIR/placeholder.png" ]; then
    cp "$FRONTEND_DIR/placeholder.png" "$BACKEND_DIR/"
    echo "Placeholder copié"
fi

if [ -f "$FRONTEND_DIR/pattern.png" ]; then
    cp "$FRONTEND_DIR/pattern.png" "$BACKEND_DIR/"
    echo "Pattern copié"
fi

# Définir les permissions
echo "Configuration des permissions..."
chmod -R 755 "$BACKEND_DIR"

# Afficher la structure des dossiers
echo "Structure des dossiers :"
ls -R "$BACKEND_DIR"

# Vérifier si nous sommes dans un environnement Git
if [ -d ".git" ]; then
    echo "Ajout des fichiers à Git..."
    git add public/
    git status
fi

echo "Script terminé" 