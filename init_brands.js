const fs = require('fs');
const path = require('path');
const https = require('https');

const BRANDS_DIR = path.join(__dirname, 'public', 'brands');

// Liste des marques et leurs dossiers
const BRANDS = [
    'CP COMPANY',
    'STONE ISLAND',
    'SALOMON',
    'PALM ANGELS',
    'OFF-WHITE'
];

// Créer un placeholder pour une marque
const createPlaceholder = (brand) => {
    const brandDir = path.join(BRANDS_DIR, brand);
    const placeholderPath = path.join(brandDir, 'placeholder.png');

    // Créer le dossier de la marque s'il n'existe pas
    if (!fs.existsSync(brandDir)) {
        fs.mkdirSync(brandDir, { recursive: true });
        console.log(`Dossier créé pour ${brand}`);
    }

    // Créer un fichier placeholder s'il n'existe pas
    if (!fs.existsSync(placeholderPath)) {
        // Créer une image placeholder simple
        const placeholderContent = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64'
        );
        fs.writeFileSync(placeholderPath, placeholderContent);
        console.log(`Placeholder créé pour ${brand}`);
    }
};

// Initialiser les dossiers et placeholders pour toutes les marques
const initBrands = () => {
    console.log('Initialisation des dossiers des marques...');

    // Créer le dossier principal s'il n'existe pas
    if (!fs.existsSync(BRANDS_DIR)) {
        fs.mkdirSync(BRANDS_DIR, { recursive: true });
        console.log('Dossier principal des marques créé');
    }

    // Créer les dossiers et placeholders pour chaque marque
    BRANDS.forEach(brand => {
        try {
            createPlaceholder(brand);
        } catch (error) {
            console.error(`Erreur lors de l'initialisation de ${brand}:`, error);
        }
    });

    console.log('Initialisation des marques terminée');
};

// Exécuter l'initialisation
initBrands(); 