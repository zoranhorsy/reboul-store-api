-- Correction des noms de fichiers exacts
UPDATE brands SET 
    logo_light = '/brands/JACOBCOHEN/jacob_b.png',
    logo_dark = '/brands/JACOBCOHEN/jacob_w.png'
WHERE name = 'JACOB COHEN';

UPDATE brands SET 
    logo_light = '/brands/LESDEUX/lesdeux_b.png',
    logo_dark = '/brands/LESDEUX/lesdeux_w.png'
WHERE name = 'LES DEUX';

UPDATE brands SET 
    logo_light = '/brands/MANUELRITZ/manuel_b.png',
    logo_dark = '/brands/MANUELRITZ/manuel_w.png'
WHERE name = 'MANUEL RITZ'; 