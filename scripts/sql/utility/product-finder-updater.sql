-- Script SQL simplifié
DO 25299
DECLARE
  ref TEXT := current_setting('ref_param');
BEGIN
  RAISE NOTICE 'Recherche produit: %', ref;
  UPDATE products SET name = current_setting('value_param') WHERE store_reference = ref AND current_setting('choice_param')::int = 1;
END
25299;