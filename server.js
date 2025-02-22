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

// Création du dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, 'public', 'uploads');
const archivesDir = path.join(__dirname, 'public', 'archives');

[uploadsDir, archivesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('Dossier créé:', dir);
    } else {
        console.log('Dossier existant:', dir);
    }
});

// Configuration CORS améliorée
const corsOptions = {
    origin: function(origin, callback) {
        const allowedOrigins = [
            'https://reboulreactversion0.vercel.app',
            'https://reboulreactversion0-oy703bs4d-horsys-projects.vercel.app',
            'https://reboul-store.vercel.app',
            'http://localhost:3000',
            'https://reboul-store-api-production.up.railway.app'
        ];
        
        // Permettre les requêtes sans origine (comme Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            console.log('Origine bloquée:', origin);
            callback(new Error('Non autorisé par CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    optionsSuccessStatus: 200,
    maxAge: 3600
};

// Middleware
app.use(cors(corsOptions));
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

// Servir les fichiers statiques avec cache-control
const staticOptions = {
    maxAge: '1h',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.jpg') || path.endsWith('.png')) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
    }
};

// Configuration des chemins statiques
app.use('/api/uploads', express.static(path.join(__dirname, 'public', 'uploads'), staticOptions));
app.use('/api/archives', express.static(path.join(__dirname, 'public', 'archives'), staticOptions));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), staticOptions));
app.use('/archives', express.static(path.join(__dirname, 'public', 'archives'), staticOptions));
app.use('/brands', express.static(path.join(__dirname, 'public', 'brands'), staticOptions));
app.use('/api/brands', express.static(path.join(__dirname, 'public', 'brands'), staticOptions));

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

