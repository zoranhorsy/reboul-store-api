const fs = require('fs');
const path = require('path');
const https = require('https');

// Chemins des dossiers
const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
const PLACEHOLDERS_DIR = path.join(__dirname, '..', 'public', 'placeholders');

// URLs des placeholders par défaut
const DEFAULT_PLACEHOLDERS = {
    'placeholder.jpg': 'https://dummyimage.com/600x800/f0f0f0/333333.jpg&text=No+Image',
    'placeholder.png': 'https://dummyimage.com/600x800/f0f0f0/333333.png&text=No+Image',
    'product-placeholder.jpg': 'https://dummyimage.com/600x800/f0f0f0/333333.jpg&text=Product',
    'category-placeholder.jpg': 'https://dummyimage.com/800x400/f0f0f0/333333.jpg&text=Category'
};

// Créer les dossiers s'ils n'existent pas
function createDirectories() {
    [UPLOADS_DIR, PLACEHOLDERS_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Dossier créé : ${dir}`);
        } else {
            console.log(`ℹ️ Le dossier existe déjà : ${dir}`);
        }
    });
}

// Télécharger un fichier
function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(destination)) {
            console.log(`ℹ️ Le fichier existe déjà : ${destination}`);
            return resolve();
        }

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Échec du téléchargement : ${response.statusCode}`));
            }

            const fileStream = fs.createWriteStream(destination);
            response.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`✅ Fichier téléchargé : ${destination}`);
                resolve();
            });

            fileStream.on('error', (err) => {
                fs.unlink(destination, () => {});
                reject(err);
            });
        }).on('error', reject);
    });
}

// Copier les placeholders dans le dossier uploads
function copyPlaceholders() {
    Object.entries(DEFAULT_PLACEHOLDERS).forEach(([filename, url]) => {
        const placeholderPath = path.join(PLACEHOLDERS_DIR, filename);
        const uploadsPath = path.join(UPLOADS_DIR, filename);

        // Copier de placeholders vers uploads si le fichier existe
        if (fs.existsSync(placeholderPath)) {
            fs.copyFileSync(placeholderPath, uploadsPath);
            console.log(`✅ Fichier copié : ${filename}`);
        }
    });
}

// Fonction principale
async function init() {
    try {
        console.log('🚀 Initialisation des dossiers uploads...');
        
        // Créer les dossiers
        createDirectories();

        // Télécharger les placeholders
        console.log('\n📥 Téléchargement des placeholders...');
        const downloads = Object.entries(DEFAULT_PLACEHOLDERS).map(([filename, url]) => {
            const destination = path.join(PLACEHOLDERS_DIR, filename);
            return downloadFile(url, destination);
        });

        await Promise.all(downloads);

        // Copier les placeholders
        console.log('\n📋 Copie des placeholders vers uploads...');
        copyPlaceholders();

        console.log('\n✨ Initialisation terminée avec succès !');
    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation :', error);
        process.exit(1);
    }
}

// Lancer l'initialisation
init(); 