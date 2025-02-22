const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const pool = require('./db');
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

// À la fin du fichier, avant les écouteurs de port
module.exports = { app };

// Fonction pour démarrer le serveur
const startServer = (port) => {
    app.listen(port, () => {
        console.log(`Serveur démarré sur le port ${port}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Le port ${port} est déjà utilisé. Tentative avec le port ${port + 1}`);
            startServer(port + 1);
        } else {
            console.error('Erreur lors du démarrage du serveur:', err);
        }
    });
};

// Ne démarrer le serveur que si nous ne sommes pas en mode test
if (process.env.NODE_ENV !== 'test') {
    // Vérification de la connexion à la base de données avant de démarrer le serveur
    pool.query('SELECT NOW()', (err) => {
        if (err) {
            console.error('Erreur de connexion à la base de données:', err);
            process.exit(1);
        } else {
            console.log('Connexion à la base de données réussie');
            const PORT = process.env.PORT || 5001;
            startServer(PORT);
        }
    });
}

