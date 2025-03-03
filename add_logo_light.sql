-- Ajouter la colonne logo_light à la table brands
ALTER TABLE brands 
ADD COLUMN logo_light text;

-- Vérifier la structure
\d brands; 