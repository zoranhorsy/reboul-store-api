-- Migration: Créer la table des réservations de stock
-- Fichier: create_stock_reservations_table.sql

CREATE TABLE IF NOT EXISTS stock_reservations (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'confirmed', 'released', 'expired')),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_stock_reservations_variant_id ON stock_reservations(variant_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order_id ON stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires_at ON stock_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status ON stock_reservations(status);

-- Index composé pour les requêtes de vérification de stock
CREATE INDEX IF NOT EXISTS idx_stock_reservations_variant_status_expires 
ON stock_reservations(variant_id, status, expires_at);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_stock_reservations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stock_reservations_updated_at_trigger
    BEFORE UPDATE ON stock_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_reservations_updated_at();

-- Commentaires pour la documentation
COMMENT ON TABLE stock_reservations IS 'Table pour gérer les réservations temporaires de stock';
COMMENT ON COLUMN stock_reservations.status IS 'Statut de la réservation: active, confirmed, released, expired';
COMMENT ON COLUMN stock_reservations.expires_at IS 'Date d''expiration de la réservation (généralement 24h après création)';
COMMENT ON COLUMN stock_reservations.order_id IS 'ID de la commande associée à cette réservation';
COMMENT ON COLUMN stock_reservations.variant_id IS 'ID du variant de produit réservé';
COMMENT ON COLUMN stock_reservations.quantity IS 'Quantité réservée pour ce variant'; 