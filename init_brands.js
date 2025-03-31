const fs = require('fs');
const path = require('path');
const https = require('https');

const BRANDS_DIR = path.join(__dirname, 'public', 'brands');

// Liste des marques et leurs images
const BRANDS = {
    'CP COMPANY': ['cp_2_b.png', 'cp_2_w.png'],
    'STONE ISLAND': ['stone_island_2_b.png', 'stone_island_2_w.png'],
    'SALOMON': ['salomon_2_b.png', 'salomon_2_w.png'],
    'PALM ANGELS': ['palmangels_b.png', 'palmangels_w.png'],
    'OFF-WHITE': ['off_white_b.png', 'off_white_w.png']
};

// Créer une image placeholder simple
const PLACEHOLDER_IMAGE = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAMAAAADACAYAAABS3GwHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAF0WlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4gPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNy4yLWMwMDAgNzkuMWI2NWE3OWI0LCAyMDIyLzA2LzEzLTIyOjAxOjAxICAgICAgICAiPiA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPiA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIgeG1wOkNyZWF0b3JUb29sPSJBZG9iZSBQaG90b3Nob3AgMjQuMCAoTWFjaW50b3NoKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjQtMDItMjJUMjE6NDg6MjQrMDE6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjQtMDItMjJUMjE6NDg6MjQrMDE6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDI0LTAyLTIyVDIxOjQ4OjI0KzAxOjAwIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjA1ZDc1YzQwLTQ2ZTQtNDJiNC1hMjM0LTBkOTU5YjQ5NjRhMSIgeG1wTU06RG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjA1ZDc1YzQwLTQ2ZTQtNDJiNC1hMjM0LTBkOTU5YjQ5NjRhMSIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjA1ZDc1YzQwLTQ2ZTQtNDJiNC1hMjM0LTBkOTU5YjQ5NjRhMSIgZGM6Zm9ybWF0PSJpbWFnZS9wbmciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjA1ZDc1YzQwLTQ2ZTQtNDJiNC1hMjM0LTBkOTU5YjQ5NjRhMSIgc3RFdnQ6d2hlbj0iMjAyNC0wMi0yMlQyMTo0ODoyNCswMTowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIDI0LjAgKE1hY2ludG9zaCkiLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+8KhHnwAAABJJREFUeJztwTEBAAAAwqD1T20ND6AAAAA+BgyOAAE=',
    'base64'
);

// Créer un placeholder pour une marque
const createPlaceholder = (brand, images) => {
    const brandDir = path.join(BRANDS_DIR, brand);

    // Créer le dossier de la marque s'il n'existe pas
    if (!fs.existsSync(brandDir)) {
        fs.mkdirSync(brandDir, { recursive: true });
        console.log(`Dossier créé pour ${brand}`);
    }

    // Pour chaque image de la marque
    images.forEach(imageName => {
        const imagePath = path.join(brandDir, imageName);
        if (!fs.existsSync(imagePath)) {
            fs.writeFileSync(imagePath, PLACEHOLDER_IMAGE);
            console.log(`Image placeholder créée: ${imagePath}`);
        }
    });
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
    Object.entries(BRANDS).forEach(([brand, images]) => {
        try {
            createPlaceholder(brand, images);
        } catch (error) {
            console.error(`Erreur lors de l'initialisation de ${brand}:`, error);
        }
    });

    // Créer un placeholder général
    const placeholderPath = path.join(__dirname, 'public', 'placeholder.png');
    if (!fs.existsSync(placeholderPath)) {
        fs.writeFileSync(placeholderPath, PLACEHOLDER_IMAGE);
        console.log('Placeholder général créé');
    }

    console.log('Initialisation des marques terminée');
};

// Exécuter l'initialisation
initBrands(); 