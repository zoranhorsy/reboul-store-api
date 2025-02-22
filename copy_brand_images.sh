#!/bin/bash

# Chemin source (frontend) et destination (backend)
SOURCE_DIR="../public/brands"
DEST_DIR="public/brands"

# Créer le dossier de destination s'il n'existe pas
mkdir -p "$DEST_DIR"

# Copier les images
echo "Copie des images des marques..."
if [ -d "$SOURCE_DIR" ]; then
    cp -R "$SOURCE_DIR"/* "$DEST_DIR/"
    echo "Images copiées avec succès!"
else
    echo "Erreur: Le dossier source $SOURCE_DIR n'existe pas"
    exit 1
fi

# Vérifier les permissions
chmod -R 755 "$DEST_DIR"

# Liste des dossiers copiés
echo "Dossiers des marques copiés:"
ls -l "$DEST_DIR" 