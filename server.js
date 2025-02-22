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
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Dossier uploads créé:', uploadsDir);
} else {
    console.log('Dossier uploads existant:', uploadsDir);
}

// Middleware
app.use(cors({
    origin: '*', // Attention : à utiliser uniquement en développement
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Ajout du middleware de logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Middleware pour les logs d'accès aux images
app.use('/uploads', (req, res, next) => {
    console.log(`Tentative d'accès à l'image: ${req.url}`);
    next();
});

// Servir les fichiers statiques
app.use('/api/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/api/archives', express.static(path.join(__dirname, 'public', 'archives')));

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
    res.json({ message: 'Bienvenue sur l\'API de Reboul Store' });
});

// Middleware de gestion des erreurs
app.use(errorHandler);

// Configuration SMTP pour Gmail
const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true pour 465, false pour 587
    auth: {
        user: process.env.SMTP_USER || 'horsydevservices@gmail.com',
        pass: process.env.SMTP_PASSWORD // Doit être un mot de passe d'application Gmail
    },
    tls: {
        rejectUnauthorized: false // Nécessaire en production
    }
};

// Log de la configuration SMTP (en masquant le mot de passe)
console.log('Configuration SMTP:', {
    ...smtpConfig,
    auth: {
        ...smtpConfig.auth,
        pass: '***'
    }
});

// Créer le transporteur SMTP
const transporter = nodemailer.createTransport(smtpConfig);

// Vérifier la connexion SMTP
transporter.verify(function(error, success) {
    if (error) {
        console.error('Erreur de configuration SMTP:', error);
        console.error('Détails de l\'erreur:', {
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode
        });
    } else {
        console.log('Serveur SMTP prêt à envoyer des emails');
    }
});

// Rendre le transporteur disponible globalement
app.set('emailTransporter', transporter);

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
        });
    }
});

