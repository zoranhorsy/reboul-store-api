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

// Configuration des dossiers
const publicDir = path.join(__dirname, 'public');
const uploadsDir = path.join(publicDir, 'uploads');
const brandsDir = path.join(publicDir, 'brands');
const archivesDir = path.join(publicDir, 'archives');

console.log('Chemins des dossiers:');
console.log('publicDir:', publicDir);
console.log('brandsDir:', brandsDir);
console.log('uploadsDir:', uploadsDir);
console.log('archivesDir:', archivesDir);

// Créer les dossiers s'ils n'existent pas
[publicDir, uploadsDir, brandsDir, archivesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Dossier créé: ${dir}`);
    } else {
        console.log(`Dossier existant: ${dir}`);
        if (dir === brandsDir) {
            console.log('Contenu du dossier brands:', fs.readdirSync(dir));
        }
    }
});

// Configuration CORS
const allowedOrigins = [
    'https://reboulreactversion0.vercel.app',
    'https://reboul-store.vercel.app',
    'http://localhost:3000'
];

const corsOptions = {
    origin: function(origin, callback) {
        console.log('Origin de la requête:', origin);
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, origin);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 3600
};

// Middleware CORS
app.use(cors(corsOptions));

// Middleware pour parser le JSON
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

// Configuration des dossiers statiques
app.use('/uploads', express.static(uploadsDir, {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

app.use('/archives', express.static(archivesDir, {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

app.use('/brands', express.static(brandsDir, {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        console.log(`Image de marque accédée: ${filePath}`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

// Route spécifique pour les images des marques
app.use('/brands', express.static(brandsDir, {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        console.log(`Image de marque accédée: ${filePath}`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

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
        
        res.json(paths);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route de test pour les images
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
        
        res.json({
            success: true,
            message: "Liste des images disponibles",
            images,
            publicDir: publicDir,
            brandsDir: brandsDir
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route racine pour tester l'API
app.get('/', (req, res) => {
    res.json({
        message: 'API Reboul Store',
        version: '1.0.0',
        status: 'running'
    });
});

// Route API
app.get('/api', (req, res) => {
    res.json({
        message: 'API Reboul Store',
        version: '1.0.0',
        endpoints: [
            '/api/products',
            '/api/categories',
            '/api/brands',
            '/check-paths',
            '/test-images'
        ]
    });
});

// Importer et utiliser les routes
app.use('/api/products', require('./routes/products'));

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
        db.query('SELECT NOW()', (err, result) => {
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
                    origin: cors.origin,
                    methods: cors.methods
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

// Route de test pour les images des marques
app.get('/api/test-brand-images', (req, res) => {
    try {
        const brandName = req.query.brand;
        const brandPath = path.join(brandsDir, brandName || '');
        
        const result = {
            brandsDir: {
                path: brandsDir,
                exists: fs.existsSync(brandsDir),
                isDirectory: fs.existsSync(brandsDir) ? fs.statSync(brandsDir).isDirectory() : false,
                permissions: fs.existsSync(brandsDir) ? fs.statSync(brandsDir).mode.toString(8) : null,
                contents: fs.existsSync(brandsDir) ? fs.readdirSync(brandsDir) : []
            }
        };
        
        if (brandName) {
            result.brandPath = {
                path: brandPath,
                exists: fs.existsSync(brandPath),
                isDirectory: fs.existsSync(brandPath) ? fs.statSync(brandPath).isDirectory() : false,
                permissions: fs.existsSync(brandPath) ? fs.statSync(brandPath).mode.toString(8) : null,
                contents: fs.existsSync(brandPath) && fs.statSync(brandPath).isDirectory() 
                    ? fs.readdirSync(brandPath) 
                    : []
            };
        }
        
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Middleware de gestion des erreurs
app.use(errorHandler);

// Démarrage du serveur
const port = process.env.PORT || 5001;

// Test de connexion initial
db.query('SELECT NOW()', (err) => {
    if (err) {
        console.error('Erreur lors du test de connexion:', err);
    } else {
        console.log('Test de connexion réussi');
        app.listen(port, () => {
            console.log(`Serveur démarré sur le port ${port}`);
            console.log('Environnement:', process.env.NODE_ENV);
            console.log('Dossier public:', publicDir);
            console.log('Dossier des marques:', brandsDir);
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

