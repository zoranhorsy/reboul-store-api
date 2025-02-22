#!/bin/bash

# Chemin de destination
DEST_DIR="public/brands"

# Créer le dossier de destination s'il n'existe pas
mkdir -p "$DEST_DIR"

# Vérifier si nous sommes sur Railway
if [ "$RAILWAY_ENVIRONMENT" = "production" ]; then
    echo "Environnement Railway détecté, utilisation des images intégrées..."
    # Les images sont déjà dans le dépôt Git, pas besoin de les copier
    echo "Images prêtes à être servies depuis $DEST_DIR"
else
    # En local, copier depuis le frontend
    SOURCE_DIR="../public/brands"
    echo "Copie des images des marques depuis $SOURCE_DIR..."
    if [ -d "$SOURCE_DIR" ]; then
        cp -R "$SOURCE_DIR"/* "$DEST_DIR/"
        echo "Images copiées avec succès!"
    else
        echo "Erreur: Le dossier source $SOURCE_DIR n'existe pas"
        exit 1
    fi
fi

# Vérifier les permissions
chmod -R 755 "$DEST_DIR"

# Liste des dossiers
echo "Dossiers des marques disponibles:"
ls -l "$DEST_DIR" 