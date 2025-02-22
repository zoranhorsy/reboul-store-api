-- Correction des chemins avec les noms exacts des fichiers
UPDATE brands SET 
    logo_light = '/brands/NUMERO21/N21_b.png',
    logo_dark = '/brands/NUMERO21/N21_w 2.png'
WHERE name = 'NUMERO 21';

UPDATE brands SET 
    logo_light = '/brands/WHITE SAND/white_b.png',
    logo_dark = '/brands/WHITE SAND/white_w.png'
WHERE name = 'WHITE SAND'; 