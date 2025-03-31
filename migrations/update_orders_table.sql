-- Ajout des nouveaux champs nécessaires
BEGIN;

-- Ajout de shipping_info si n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shipping_info') THEN
        ALTER TABLE orders ADD COLUMN shipping_info JSONB;
    END IF;
END $$;

-- Ajout de order_number si n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='order_number') THEN
        ALTER TABLE orders ADD COLUMN order_number VARCHAR(50);
        -- Générer des numéros pour les commandes existantes
        UPDATE orders SET order_number = 'ORDER-' || LPAD(id::text, 8, '0') WHERE order_number IS NULL;
        ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;
        ALTER TABLE orders ADD CONSTRAINT orders_order_number_unique UNIQUE (order_number);
    END IF;
END $$;

-- Ajout de payment_status si n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_status') THEN
        ALTER TABLE orders ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';
    END IF;
END $$;

-- Mise à jour des contraintes de status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('pending', 'processing', 'completed', 'shipped', 'delivered', 'cancelled'));

-- Ajout de la contrainte payment_status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
    CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'));

-- Ajout des index s'ils n'existent pas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_order_number') THEN
        CREATE INDEX idx_orders_order_number ON orders(order_number);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_status') THEN
        CREATE INDEX idx_orders_status ON orders(status);
    END IF;
END $$;

-- Création de la fonction de mise à jour
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Création du trigger s'il n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_updated_at') THEN
        CREATE TRIGGER update_orders_updated_at
            BEFORE UPDATE ON orders
            FOR EACH ROW
            EXECUTE FUNCTION update_orders_updated_at();
    END IF;
END $$;

COMMIT; 