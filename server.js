const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
require('dotenv').config();
const db = require('./db');
const { errorHandler } = require('./middleware/errorHandler');
const uploadRoutes = require('./routes/upload');
const adminRouter = require('./routes/admin');
const app = express();

// Création des dossiers nécessaires
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const archivesDir = path.join(__dirname, 'public', 'archives');
const brandsDir = path.join(__dirname, 'public', 'brands');
const publicDir = path.join(__dirname, 'public');

// S'assurer que le dossier public existe
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('Dossier public créé:', publicDir);
}

// Créer les sous-dossiers nécessaires
[uploadsDir, archivesDir, brandsDir].forEach(dir => {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log('Dossier créé:', dir);
            // Définir les permissions
            fs.chmodSync(dir, 0o755);
        } else {
            console.log('Dossier existant:', dir);
            // Vérifier et corriger les permissions si nécessaire
            try {
                fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
            } catch (err) {
                console.log('Correction des permissions pour:', dir);
                fs.chmodSync(dir, 0o755);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la création/vérification du dossier:', dir, error);
    }
});

// Configuration CORS améliorée
const corsOptions = {
    origin: '*', // Permettre toutes les origines en production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    optionsSuccessStatus: 200,
    maxAge: 3600
};

// Middleware CORS simple
app.use(cors(corsOptions));

// Headers CORS supplémentaires pour plus de compatibilité
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    console.log('Origin:', req.headers.origin);
    next();
});

// Configuration des headers de sécurité et de cache
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Configuration des dossiers statiques avec options
app.use('/public', express.static(publicDir, {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        console.log(`Fichier statique accédé: ${path}`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Définir le bon type MIME pour les images
        if (path.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
        } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
        }
    }
}));

// Servir les images des marques directement
app.use('/brands', express.static(brandsDir, {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        console.log(`Image de marque accédée: ${path}`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Définir le bon type MIME
        if (path.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
        } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
        }
    }
}));

// Route racine pour servir tous les fichiers du dossier public
app.get('/', (req, res) => {
    res.send('API Reboul Store');
});

// Route de test pour vérifier les chemins
app.get('/check-paths', (req, res) => {
    try {
        const paths = {
            publicDir: {
                path: publicDir,
                exists: fs.existsSync(publicDir),
                isDirectory: fs.existsSync(publicDir) ? fs.statSync(publicDir).isDirectory() : false,
                readable: fs.existsSync(publicDir) ? fs.accessSync(publicDir, fs.constants.R_OK) : false
            },
            brandsDir: {
                path: brandsDir,
                exists: fs.existsSync(brandsDir),
                isDirectory: fs.existsSync(brandsDir) ? fs.statSync(brandsDir).isDirectory() : false,
                readable: fs.existsSync(brandsDir) ? fs.accessSync(brandsDir, fs.constants.R_OK) : false,
                contents: fs.existsSync(brandsDir) ? fs.readdirSync(brandsDir) : []
            }
        };
        
        // Log détaillé
        console.log('Check paths result:', JSON.stringify(paths, null, 2));
        
        res.json(paths);
    } catch (error) {
        console.error('Error in check-paths:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route pour tester les images
app.get('/test-images', (req, res) => {
    try {
        const images = [];
        const brandDirs = fs.readdirSync(brandsDir);
        
        brandDirs.forEach(brand => {
            const brandPath = path.join(brandsDir, brand);
            if (fs.statSync(brandPath).isDirectory()) {
                const brandImages = fs.readdirSync(brandPath)
                    .filter(file => file.match(/\.(jpg|jpeg|png)$/i))
                    .map(file => `/brands/${brand}/${file}`);
                images.push({
                    brand,
                    images: brandImages
                });
            }
        });
        
        // Log détaillé
        console.log('Test images result:', JSON.stringify(images, null, 2));
        
        res.json({
            success: true,
            message: "Liste des images disponibles",
            images,
            publicDir: publicDir,
            brandsDir: brandsDir
        });
    } catch (error) {
        console.error('Error in test-images:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route spécifique pour les images des marques avec fallback
app.get('/brands/:brand/:image', (req, res) => {
    const { brand, image } = req.params;
    console.log(`Demande d'image de marque: ${brand}/${image}`);
    
    const imagePath = path.join(brandsDir, brand, image);
    console.log('Chemin complet:', imagePath);
    
    if (fs.existsSync(imagePath)) {
        const ext = path.extname(imagePath).toLowerCase();
        const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Stream le fichier
        const stream = fs.createReadStream(imagePath);
        stream.pipe(res);
    } else {
        // Fallback vers le placeholder
        const placeholderPath = path.join(publicDir, 'placeholder.png');
        if (fs.existsSync(placeholderPath)) {
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            const stream = fs.createReadStream(placeholderPath);
            stream.pipe(res);
        } else {
            res.status(404).json({
                error: 'Image not found',
                requestedPath: imagePath
            });
        }
    }
});

// Routes
const categoriesRouter = require('./routes/categories');
const productsRouter = require('./routes/products');
const brandsRouter = require('./routes/brands');
const ordersRouter = require('./routes/orders');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const addressesRouter = require('./routes/addresses');
const reviewsRouter = require('./routes/reviews');
const statsRouter = require('./routes/stats');
const archivesRouter = require('./routes/archives');

// Enregistrement des routes avec le préfixe /api
app.use('/api/categories', categoriesRouter);
app.use('/api/products', productsRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/addresses', addressesRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRouter);
app.use('/api/archives', archivesRouter);

// Route de test
app.get('/api', (req, res) => {
    res.json({ 
        message: 'Bienvenue sur l\'API de Reboul Store',
        status: 'running',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// Configuration SMTP pour Gmail
const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
};

// Créer le transporteur SMTP
const transporter = nodemailer.createTransport(smtpConfig);

// Route de test pour l'email
app.post('/api/test-email', async (req, res) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: req.body.to || process.env.SMTP_USER,
            subject: 'Test Email - Reboul Store API',
            text: 'Si vous recevez cet email, la configuration SMTP fonctionne correctement.',
            html: '<h1>Test Email</h1><p>Si vous recevez cet email, la configuration SMTP fonctionne correctement.</p>'
        });

        console.log('Email de test envoyé:', info);
        res.json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email de test:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: {
                code: error.code,
                command: error.command,
                response: error.response,
                responseCode: error.responseCode
            }
        });
    }
});

// Route de test complète
app.get('/status', (req, res) => {
    try {
        // Vérifier l'accès aux dossiers
        const dirs = {
            public: fs.accessSync(publicDir, fs.constants.R_OK | fs.constants.W_OK),
            brands: fs.accessSync(brandsDir, fs.constants.R_OK | fs.constants.W_OK),
            uploads: fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK),
            archives: fs.accessSync(archivesDir, fs.constants.R_OK | fs.constants.W_OK)
        };

        // Vérifier la base de données
        db.pool.query('SELECT NOW()', (err, result) => {
            const status = {
                server: {
                    status: 'running',
                    environment: process.env.NODE_ENV,
                    timestamp: new Date().toISOString(),
                    node_version: process.version,
                    memory_usage: process.memoryUsage(),
                    uptime: process.uptime()
                },
                directories: {
                    public: {
                        path: publicDir,
                        accessible: true,
                        contents: fs.readdirSync(publicDir)
                    },
                    brands: {
                        path: brandsDir,
                        accessible: true,
                        contents: fs.readdirSync(brandsDir)
                    }
                },
                database: {
                    connected: !err,
                    timestamp: err ? null : result.rows[0].now,
                    error: err ? err.message : null
                },
                cors: {
                    enabled: true,
                    origin: corsOptions.origin,
                    methods: corsOptions.methods
                }
            };

            res.json(status);
        });
    } catch (error) {
        res.status(500).json({
            error: 'Server status check failed',
            details: error.message
        });
    }
});

// Middleware de gestion des erreurs
app.use(errorHandler);

// Démarrage du serveur
const PORT = process.env.PORT || 5001;

// Test de connexion à la base de données avant de démarrer le serveur
db.pool.query('SELECT NOW()', (err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err);
        process.exit(1);
    } else {
        console.log('Connexion à la base de données réussie');
        app.listen(PORT, () => {
            console.log(`Serveur démarré sur le port ${PORT}`);
            console.log('Configuration CORS:', {
                origins: corsOptions.origin,
                methods: corsOptions.methods
            });
        });
    }
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

