-- Correction des chemins pour les marques sans images
UPDATE brands SET 
    logo_light = '/brands/AFTER LABEL/after_b.png',
    logo_dark = '/brands/AFTER LABEL/after_w.png'
WHERE name = 'AFTER LABEL';

UPDATE brands SET 
    logo_light = '/brands/APC/apc_b.png',
    logo_dark = '/brands/APC/apc_w.png'
WHERE name = 'APC';

UPDATE brands SET 
    logo_light = '/brands/AXEL ARIGATO/axel_b.png',
    logo_dark = '/brands/AXEL ARIGATO/axel_w.png'
WHERE name = 'AXEL ARIGATO';

UPDATE brands SET 
    logo_light = '/brands/JACOB COHEN/jacob_cohen_b.png',
    logo_dark = '/brands/JACOB COHEN/jacob_cohen_w.png'
WHERE name = 'JACOB COHEN';

UPDATE brands SET 
    logo_light = '/brands/LES DEUX/les_deux_b.png',
    logo_dark = '/brands/LES DEUX/les_deux_w.png'
WHERE name = 'LES DEUX';

UPDATE brands SET 
    logo_light = '/brands/DOUCALS/doucals_b.png',
    logo_dark = '/brands/DOUCALS/doucals_w.png'
WHERE name = 'DOUCAL''S';

UPDATE brands SET 
    logo_light = '/brands/MANUEL RITZ/manuel_ritz_b.png',
    logo_dark = '/brands/MANUEL RITZ/manuel_ritz_w.png'
WHERE name = 'MANUEL RITZ';

UPDATE brands SET 
    logo_light = '/brands/MERCER/mercer_b.png',
    logo_dark = '/brands/MERCER/mercer_w.png'
WHERE name = 'MERCER';

UPDATE brands SET 
    logo_light = '/brands/NUMERO 21/numero21_b.png',
    logo_dark = '/brands/NUMERO 21/numero21_w.png'
WHERE name = 'NUMERO 21';

UPDATE brands SET 
    logo_light = '/brands/PARAJUMPERS/parajumpers_b.png',
    logo_dark = '/brands/PARAJUMPERS/parajumpers_w.png'
WHERE name = 'PARAJUMPERS';

UPDATE brands SET 
    logo_light = '/brands/PATAGONIA/patagonia_b.png',
    logo_dark = '/brands/PATAGONIA/patagonia_w.png'
WHERE name = 'PATAGONIA';

UPDATE brands SET 
    logo_light = '/brands/WHITE SAND/white_sand_b.png',
    logo_dark = '/brands/WHITE SAND/white_sand_w.png'
WHERE name = 'WHITE SAND'; 