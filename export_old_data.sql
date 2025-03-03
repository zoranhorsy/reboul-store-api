\COPY (SELECT * FROM products) TO 'old_products.csv' WITH CSV HEADER;
\COPY (SELECT * FROM brands) TO 'old_brands.csv' WITH CSV HEADER;

-- Afficher un message de confirmation
\echo 'Export terminé. Vérifiez les fichiers old_products.csv et old_brands.csv' 