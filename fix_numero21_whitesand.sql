-- Correction des chemins pour NUMERO 21 et WHITE SAND
UPDATE brands SET 
    logo_light = '/brands/NUMERO21/NUMERO21_b.png',
    logo_dark = '/brands/NUMERO21/NUMERO21_w.png'
WHERE name = 'NUMERO 21';

UPDATE brands SET 
    logo_light = '/brands/WHITESAND/WHITESAND_b.png',
    logo_dark = '/brands/WHITESAND/WHITESAND_w.png'
WHERE name = 'WHITE SAND'; 