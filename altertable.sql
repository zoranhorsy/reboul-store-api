ALTER TABLE products
    ADD COLUMN brand VARCHAR(255),
    ADD COLUMN images TEXT[],
    ADD COLUMN variants JSONB,
    ADD COLUMN tags TEXT[],
    ADD COLUMN reviews JSONB,
    ADD COLUMN questions JSONB,
    ADD COLUMN faqs JSONB,
    ADD COLUMN size_chart JSONB,
    ADD COLUMN store_type VARCHAR(50),
    ADD COLUMN featured BOOLEAN DEFAULT false,
    ADD COLUMN colors TEXT[];

