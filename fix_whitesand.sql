-- Correction du chemin pour WHITE SAND avec espace encodé
UPDATE brands SET 
    logo_light = '/brands/WHITE%20SAND/white_b.png',
    logo_dark = '/brands/WHITE%20SAND/white_w.png'
WHERE name = 'WHITE SAND'; 