-- Supprimer la colonne password si elle existe
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Ajouter la colonne password_hash
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL; 