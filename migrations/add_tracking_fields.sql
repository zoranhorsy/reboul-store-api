-- Migration pour ajouter les champs de suivi à la table orders
-- Date: 2024-01-15
-- Description: Ajouter les colonnes tracking_number et carrier pour le suivi des commandes

BEGIN;

-- Ajouter les colonnes tracking_number et carrier si elles n'existent pas déjà
DO $$ 
BEGIN
    -- Ajouter tracking_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='orders' AND column_name='tracking_number') THEN
        ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100);
    END IF;
    
    -- Ajouter carrier (transporteur)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='orders' AND column_name='carrier') THEN
        ALTER TABLE orders ADD COLUMN carrier VARCHAR(100);
    END IF;
END $$;

-- Créer un index pour améliorer les performances des recherches par numéro de suivi
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON orders(tracking_number) WHERE tracking_number IS NOT NULL;

-- Créer un index pour les recherches par transporteur
CREATE INDEX IF NOT EXISTS idx_orders_carrier ON orders(carrier) WHERE carrier IS NOT NULL;

COMMIT;

-- Commentaires pour la documentation
COMMENT ON COLUMN orders.tracking_number IS 'Numéro de suivi de la commande fourni par le transporteur';
COMMENT ON COLUMN orders.carrier IS 'Nom du transporteur (Colissimo, Chronopost, DHL, etc.)'; 