const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '..', 'public', 'uploads');
        console.log(`Destination de l'upload: ${uploadPath}`);
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname);
        console.log(`Nom du fichier généré: ${filename}`);
        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
        console.log(`Type de fichier accepté: ${file.mimetype}`);
        cb(null, true);
    } else {
        console.log(`Type de fichier rejeté: ${file.mimetype}`);
        cb(new Error('Type de fichier non supporté. Seuls les fichiers JPEG, PNG et GIF sont acceptés.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // Limite à 5MB
    }
});

const uploadMiddleware = (req, res, next) => {
    console.log('Début du processus d\'upload');
    console.log('Corps de la requête:', req.body);
    console.log('Fichiers dans la requête:', req.files);

    upload.fields([
        { name: 'image_url', maxCount: 1 },
        { name: 'images', maxCount: 5 }
    ])(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            console.error('Erreur Multer lors de l\'upload:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'La taille du fichier dépasse la limite autorisée (5MB).' });
            }
            return res.status(400).json({ error: 'Erreur lors de l\'upload du fichier.' });
        } else if (err) {
            console.error('Erreur non-Multer lors de l\'upload:', err);
            return res.status(500).json({ error: err.message });
        }

        console.log('Files uploaded successfully');
        if (req.files) {
            console.log('Uploaded files:', Object.keys(req.files).map(key => ({
                fieldname: key,
                files: req.files[key].map(f => f.filename)
            })));
        }

        next();
    });
};

module.exports = uploadMiddleware;

