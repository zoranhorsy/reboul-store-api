-- Création de la table archive_images
CREATE TABLE IF NOT EXISTS archive_images (
    id SERIAL PRIMARY KEY,
    archive_id INTEGER NOT NULL REFERENCES archives(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trigger pour mettre à jour le timestamp updated_at
CREATE TRIGGER update_archive_images_updated_at
    BEFORE UPDATE ON archive_images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migration des données existantes
INSERT INTO archive_images (archive_id, image_url, display_order)
SELECT id, image_path, 0 FROM archives WHERE image_path IS NOT NULL;

-- Suppression de la colonne image_path de la table archives
ALTER TABLE archives DROP COLUMN image_path; 