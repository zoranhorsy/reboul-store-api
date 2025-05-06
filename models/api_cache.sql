-- Table pour stocker le cache des requêtes API
CREATE TABLE IF NOT EXISTS api_cache (
    id SERIAL PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Index pour recherche rapide par clé
    CONSTRAINT unique_cache_key UNIQUE (cache_key)
);

-- Index sur la date de création pour nettoyer les entrées expirées
CREATE INDEX IF NOT EXISTS api_cache_created_at_idx ON api_cache (created_at);

-- Commentaire sur la table
COMMENT ON TABLE api_cache IS 'Cache pour les requêtes API fréquentes pour améliorer les performances';

-- Fonction pour nettoyer le cache expiré (plus vieux que 30 minutes)
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM api_cache 
    WHERE created_at < NOW() - INTERVAL '30 minutes'
    RETURNING COUNT(*) INTO deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour nettoyer périodiquement le cache (optionnel, à exécuter via un job)
COMMENT ON FUNCTION clean_expired_cache() IS 'Fonction pour supprimer les entrées de cache expirées'; 