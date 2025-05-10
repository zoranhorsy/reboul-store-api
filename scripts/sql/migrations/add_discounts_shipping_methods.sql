-- Ajouter les colonnes pour les méthodes de livraison et les codes de réduction à la table orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method VARCHAR(50) DEFAULT 'standard';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code VARCHAR(50) DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) DEFAULT 0;

-- Créer une table pour stocker les codes de réduction
CREATE TABLE IF NOT EXISTS discount_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed')),
    value DECIMAL(10, 2) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    max_uses INTEGER DEFAULT NULL,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT NULL,
    created_by INTEGER REFERENCES users(id)
);

-- Créer un index sur le code pour des recherches rapides
CREATE INDEX IF NOT EXISTS discount_codes_code_idx ON discount_codes(code);

-- Ajouter quelques codes de réduction pour les tests
INSERT INTO discount_codes (code, type, value, description, active, max_uses, expires_at)
VALUES
    ('BIENVENUE10', 'percentage', 10, 'Réduction de 10% pour les nouveaux clients', TRUE, 100, CURRENT_TIMESTAMP + INTERVAL '30 days'),
    ('ETE2023', 'percentage', 15, 'Réduction d''été 15%', TRUE, 50, CURRENT_TIMESTAMP + INTERVAL '60 days'),
    ('LIVRAISON', 'fixed', 8, 'Livraison gratuite (réduction de 8€)', TRUE, 200, CURRENT_TIMESTAMP + INTERVAL '90 days')
ON CONFLICT (code) DO NOTHING;

-- Mettre à jour la fonction de recherche de commandes pour inclure les nouvelles colonnes
CREATE OR REPLACE FUNCTION search_orders(
    search_query TEXT,
    page_number INTEGER DEFAULT 1,
    page_size INTEGER DEFAULT 10,
    sort_field TEXT DEFAULT 'created_at',
    sort_direction TEXT DEFAULT 'DESC'
)
RETURNS TABLE (
    id INTEGER,
    user_id INTEGER,
    total_amount DECIMAL(10, 2),
    shipping_info JSONB,
    status VARCHAR(50),
    payment_status VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    order_number VARCHAR(50),
    stripe_session_id VARCHAR(255),
    payment_data JSONB,
    shipping_method VARCHAR(50),
    discount_code VARCHAR(50),
    discount_amount DECIMAL(10, 2),
    items JSONB,
    user_email TEXT,
    total_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH order_items_json AS (
        SELECT
            oi.order_id,
            jsonb_agg(
                jsonb_build_object(
                    'id', oi.id,
                    'product_id', oi.product_id,
                    'quantity', oi.quantity,
                    'price', oi.price,
                    'variant_info', oi.variant_info,
                    'product_name', p.name,
                    'product_image', p.image_url
                )
            ) AS items
        FROM
            order_items oi
        LEFT JOIN
            products p ON oi.product_id = p.id
        GROUP BY
            oi.order_id
    ),
    filtered_orders AS (
        SELECT
            o.id,
            o.user_id,
            o.total_amount,
            o.shipping_info,
            o.status,
            o.payment_status,
            o.created_at,
            o.updated_at,
            o.order_number,
            o.stripe_session_id,
            o.payment_data,
            o.shipping_method,
            o.discount_code,
            o.discount_amount,
            oij.items,
            u.email as user_email,
            COUNT(*) OVER() AS total_count
        FROM
            orders o
        LEFT JOIN
            order_items_json oij ON o.id = oij.order_id
        LEFT JOIN
            users u ON o.user_id = u.id
        WHERE
            LOWER(o.order_number) LIKE LOWER('%' || search_query || '%')
            OR LOWER(u.email) LIKE LOWER('%' || search_query || '%')
            OR CAST(o.id AS TEXT) LIKE search_query || '%'
            OR LOWER(o.status) LIKE LOWER('%' || search_query || '%')
            OR LOWER(o.payment_status) LIKE LOWER('%' || search_query || '%')
            OR LOWER(o.shipping_method) LIKE LOWER('%' || search_query || '%')
            OR LOWER(o.discount_code) LIKE LOWER('%' || search_query || '%')
    )
    SELECT * FROM filtered_orders
    ORDER BY
        CASE WHEN sort_direction = 'ASC' THEN
            CASE 
                WHEN sort_field = 'id' THEN id::TEXT
                WHEN sort_field = 'total_amount' THEN total_amount::TEXT
                WHEN sort_field = 'status' THEN status
                WHEN sort_field = 'payment_status' THEN payment_status
                WHEN sort_field = 'created_at' THEN created_at::TEXT
                WHEN sort_field = 'order_number' THEN order_number
                WHEN sort_field = 'user_email' THEN user_email
                WHEN sort_field = 'shipping_method' THEN shipping_method
                WHEN sort_field = 'discount_code' THEN discount_code
                WHEN sort_field = 'discount_amount' THEN discount_amount::TEXT
                ELSE created_at::TEXT
            END
        END ASC,
        CASE WHEN sort_direction = 'DESC' THEN
            CASE 
                WHEN sort_field = 'id' THEN id::TEXT
                WHEN sort_field = 'total_amount' THEN total_amount::TEXT
                WHEN sort_field = 'status' THEN status
                WHEN sort_field = 'payment_status' THEN payment_status
                WHEN sort_field = 'created_at' THEN created_at::TEXT
                WHEN sort_field = 'order_number' THEN order_number
                WHEN sort_field = 'user_email' THEN user_email
                WHEN sort_field = 'shipping_method' THEN shipping_method
                WHEN sort_field = 'discount_code' THEN discount_code
                WHEN sort_field = 'discount_amount' THEN discount_amount::TEXT
                ELSE created_at::TEXT
            END
        END DESC
    LIMIT page_size
    OFFSET (page_number - 1) * page_size;
END;
$$ LANGUAGE plpgsql; 