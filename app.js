const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/auth');
const productsRoutes = require('./routes/products');
const ordersRoutes = require('./routes/orders');
const usersRoutes = require('./routes/users');
const categoriesRoutes = require('./routes/categories');
const brandsRoutes = require('./routes/brandRoutes');
const statsRoutes = require('./routes/stats');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');
const reviewsRoutes = require('./routes/reviews');
const addressesRoutes = require('./routes/addresses');
const cornerProductsRoutes = require('./routes/cornerProducts');
const cornerProductVariantsRoutes = require('./routes/cornerProductVariants');
const contactRoutes = require('./routes/contact');
// const collectionsCarouselRoutes = require('./routes/collectionsCarousel');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();

// Configuration CORS
app.use(cors({
    origin: [
        'http://localhost:3000', 
        'https://reboul-store-api-production.up.railway.app',
        'https://reboul-store.vercel.app',
        'https://reboul-store-git-main-zoranhorsy.vercel.app',
        'https://reboul-store-zoranhorsy.vercel.app',
        'https://reboulstore.com',
        'https://www.reboulstore.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Configuration du middleware de compression pour toutes les réponses
app.use(compression({
    // Niveau de compression: 0 = aucune compression, 9 = compression maximale (plus lent)
    level: 6,
    // Seuil minimal en octets pour la compression (ne pas compresser les petites réponses)
    threshold: 1024,
    // Filtre pour déterminer quelles réponses compresser
    filter: (req, res) => {
        // Ne pas compresser les réponses pour les requêtes qui incluent 'no-compression'
        if (req.headers['x-no-compression']) {
            return false;
        }
        // Utiliser le comportement par défaut de compression pour les autres requêtes
        return compression.filter(req, res);
    }
}));

// Middleware pour parser le JSON
app.use(bodyParser.json({ limit: '50mb' }));

app.use(express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/brands', brandsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/addresses', addressesRoutes);
app.use('/api/corner-products', cornerProductsRoutes);
app.use('/api/corner-product-variants', cornerProductVariantsRoutes);
app.use('/api/contact', contactRoutes);
// app.use('/api/collections-carousel', collectionsCarouselRoutes);
app.use("/api/sneakers-products", require("./routes/sneakersProducts"));
app.use("/api/minots-products", require("./routes/minotsProducts"));

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 