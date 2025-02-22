-- Correction des chemins pour les dossiers sans espaces
UPDATE brands SET 
    logo_light = '/brands/JACOBCOHEN/jacob_b.png',
    logo_dark = '/brands/JACOBCOHEN/jacob_w.png'
WHERE name = 'JACOB COHEN';

UPDATE brands SET 
    logo_light = '/brands/LESDEUX/les_deux_b.png',
    logo_dark = '/brands/LESDEUX/les_deux_w.png'
WHERE name = 'LES DEUX';

UPDATE brands SET 
    logo_light = '/brands/MANUELRITZ/manuel_ritz_b.png',
    logo_dark = '/brands/MANUELRITZ/manuel_ritz_w.png'
WHERE name = 'MANUEL RITZ'; 