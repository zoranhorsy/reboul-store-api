-- Add store_reference column to products table
ALTER TABLE public.products
    ADD COLUMN store_reference VARCHAR(100);

-- Add comment to explain purpose
COMMENT ON COLUMN public.products.store_reference IS 'Reference code for the store where the product is located, for better stock organization';

-- Create index for faster lookups by store reference
CREATE INDEX idx_products_store_reference ON public.products(store_reference); 