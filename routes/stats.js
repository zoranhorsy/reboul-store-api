const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// Fonction pour vérifier l'existence d'une table
const tableExists = async (tableName) => {
    const result = await pool.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
        )
    `, [tableName]);
    return result.rows[0].exists;
};

// Fonction pour créer les tables nécessaires
const initializeTables = async () => {
    try {
        console.log('Vérification et création des tables nécessaires...');

        // Vérifier et créer la table orders si elle n'existe pas
        if (!await tableExists('orders')) {
            await pool.query(`
                CREATE TABLE orders (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    total_amount DECIMAL(10,2) NOT NULL,
                    status VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('Table orders créée');
        }

        // Vérifier et créer la table order_items si elle n'existe pas
        if (!await tableExists('order_items')) {
            await pool.query(`
                CREATE TABLE order_items (
                    id SERIAL PRIMARY KEY,
                    order_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    quantity INTEGER NOT NULL,
                    price DECIMAL(10,2) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('Table order_items créée');
        }

        // Vérifier et créer la table stats_cache
        if (!await tableExists('stats_cache')) {
            await pool.query(`
                CREATE TABLE stats_cache (
                    id SERIAL PRIMARY KEY,
                    stat_type VARCHAR(50) NOT NULL,
                    stat_date DATE NOT NULL,
                    data JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(stat_type, stat_date)
                )
            `);
            console.log('Table stats_cache créée');
        }

        console.log('Initialisation des tables terminée avec succès');
    } catch (error) {
        console.error('Erreur lors de l\'initialisation des tables:', error);
        throw error;
    }
};

// Exécuter l'initialisation au démarrage
initializeTables().catch(console.error);

// Fonction pour mettre à jour le cache
const updateStatsCache = async (statType, statDate, data) => {
    try {
        console.log(`Mise à jour du cache pour ${statType}`, { date: statDate, data });
        
        const result = await pool.query(`
            INSERT INTO stats_cache (stat_type, stat_date, data)
            VALUES ($1, $2, $3)
            ON CONFLICT (stat_type, stat_date)
            DO UPDATE SET 
                data = $3,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `, [statType, statDate, JSON.stringify(data)]);
        
        console.log(`Cache mis à jour avec succès pour ${statType}`);
        return result.rows[0];
    } catch (error) {
        console.error(`Erreur lors de la mise à jour du cache pour ${statType}:`, error);
        throw error;
    }
};

// GET - Statistiques globales du dashboard
router.get('/dashboard', authMiddleware, async (req, res, next) => {
    if (!req.user.isAdmin) {
        return next(new AppError('Accès non autorisé', 403));
    }

    try {
        console.log('Récupération des statistiques du dashboard...');
        
        // Vérifier que les tables existent
        const tablesExist = await Promise.all([
            tableExists('orders'),
            tableExists('order_items'),
            tableExists('stats_cache')
        ]);

        if (!tablesExist.every(exists => exists)) {
            await initializeTables();
        }

        const stats = await pool.query(`
            SELECT
                (SELECT COUNT(*) FROM orders) as total_orders,
                (SELECT COUNT(*) FROM products) as total_products,
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders) as total_revenue
        `);

        console.log('Statistiques calculées:', stats.rows[0]);
        res.json(stats.rows[0]);
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        next(new AppError('Erreur lors de la récupération des statistiques', 500));
    }
});

// GET - Statistiques des ventes mensuelles
router.get('/monthly-sales', authMiddleware, async (req, res, next) => {
    if (!req.user.isAdmin) {
        return next(new AppError('Accès non autorisé', 403));
    }

    try {
        console.log('Récupération des statistiques de ventes mensuelles...');
        
        // Vérifier le cache
        const cachedStats = await pool.query(`
            SELECT data FROM stats_cache 
            WHERE stat_type = 'monthly_sales' 
            AND stat_date = CURRENT_DATE
            AND updated_at >= NOW() - INTERVAL '1 day'
        `);

        if (cachedStats.rows.length > 0) {
            console.log('Statistiques mensuelles trouvées dans le cache');
            return res.json(cachedStats.rows[0].data);
        }

        console.log('Calcul des nouvelles statistiques mensuelles...');
        
        const { rows } = await pool.query(`
            WITH monthly_stats AS (
                SELECT 
                    DATE_TRUNC('month', created_at) as month,
                    COUNT(*) as order_count,
                    COALESCE(SUM(total_amount), 0) as revenue,
                    COUNT(DISTINCT user_id) as unique_customers
                FROM orders
                WHERE created_at >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY month DESC
                LIMIT 12
            )
            SELECT 
                to_char(month, 'YYYY-MM-DD') as month,
                order_count::integer,
                ROUND(revenue::numeric, 2) as revenue,
                unique_customers::integer
            FROM monthly_stats
        `);

        // Mettre en cache
        if (rows.length > 0) {
            await updateStatsCache('monthly_sales', new Date(), rows);
        }

        console.log('Statistiques mensuelles calculées:', rows);
        res.json(rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des ventes mensuelles:', error);
        next(new AppError('Erreur lors de la récupération des ventes mensuelles', 500));
    }
});

// GET - Top produits par catégorie
router.get('/top-products-by-category', authMiddleware, async (req, res, next) => {
    if (!req.user.isAdmin) {
        return next(new AppError('Accès non autorisé', 403));
    }

    try {
        console.log('Récupération des top produits par catégorie...');
        
        // Vérifier le cache
        const cachedStats = await pool.query(`
            SELECT data FROM stats_cache 
            WHERE stat_type = 'top_products' 
            AND stat_date = CURRENT_DATE
            AND updated_at >= NOW() - INTERVAL '1 day'
        `);

        if (cachedStats.rows.length > 0) {
            console.log('Top produits trouvés dans le cache');
            return res.json(cachedStats.rows[0].data);
        }

        console.log('Calcul des nouveaux top produits...');
        
        const { rows } = await pool.query(`
            SELECT 
                c.name as category_name,
                p.name as product_name,
                COUNT(oi.product_id) as total_sold,
                COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            GROUP BY c.name, p.name
            ORDER BY total_sold DESC
            LIMIT 10
        `);

        // Mettre en cache
        await updateStatsCache('top_products', new Date(), rows);

        console.log('Top produits calculés et mis en cache avec succès');
        res.json(rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des top produits:', error);
        next(new AppError('Erreur lors de la récupération des produits par catégorie', 500));
    }
});

// GET - Statistiques des clients
router.get('/customer-stats', authMiddleware, async (req, res, next) => {
    if (!req.user.isAdmin) {
        return next(new AppError('Accès non autorisé', 403));
    }

    try {
        console.log('Récupération des statistiques clients...');
        
        // Vérifier le cache
        const cachedStats = await pool.query(`
            SELECT data FROM stats_cache 
            WHERE stat_type = 'customer_stats' 
            AND stat_date = CURRENT_DATE
            AND updated_at >= NOW() - INTERVAL '1 day'
        `);

        if (cachedStats.rows.length > 0) {
            console.log('Statistiques clients trouvées dans le cache');
            return res.json(cachedStats.rows[0].data);
        }

        console.log('Calcul des nouvelles statistiques clients...');
        
        const { rows } = await pool.query(`
            WITH monthly_stats AS (
                SELECT 
                    DATE_TRUNC('month', created_at)::DATE as month,
                    COUNT(*) as new_users
                FROM users
                WHERE created_at >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', created_at)
            ),
            active_users AS (
                SELECT 
                    DATE_TRUNC('month', created_at)::DATE as month,
                    COUNT(DISTINCT user_id) as active_users
                FROM orders
                WHERE created_at >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', created_at)
            )
            SELECT 
                ms.month,
                ms.new_users,
                COALESCE(au.active_users, 0) as active_users
            FROM monthly_stats ms
            LEFT JOIN active_users au ON ms.month = au.month
            ORDER BY ms.month DESC
        `);

        // Mettre en cache
        await updateStatsCache('customer_stats', new Date(), rows);

        console.log('Statistiques clients calculées et mises en cache avec succès');
        res.json(rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques clients:', error);
        next(new AppError('Erreur lors de la récupération des statistiques clients', 500));
    }
});

// Tâche de nettoyage du cache (à exécuter périodiquement)
const cleanupStatsCache = async () => {
    try {
        const result = await pool.query(`
            DELETE FROM stats_cache 
            WHERE updated_at < NOW() - INTERVAL '7 days'
        `);
        console.log(`Nettoyage du cache de statistiques effectué: ${result.rowCount} entrées supprimées`);
    } catch (error) {
        console.error('Erreur lors du nettoyage du cache:', error);
    }
};

// Nettoyer le cache tous les jours à minuit
if (process.env.NODE_ENV !== 'test') {
    setInterval(cleanupStatsCache, 24 * 60 * 60 * 1000);
}

// GET - Sales statistics
router.get('/sales', authMiddleware, async (req, res, next) => {
    if (!req.user.isAdmin) {
        return next(new AppError('Accès non autorisé', 403));
    }

    try {
        const { from, to } = req.query;
        console.log('Récupération des statistiques de ventes...', { from, to });
        
        const { rows } = await pool.query(`
            SELECT 
                DATE_TRUNC('day', created_at)::date as date,
                COUNT(*) as orders,
                COALESCE(SUM(total_amount), 0) as amount
            FROM orders
            WHERE created_at BETWEEN $1 AND $2
            GROUP BY DATE_TRUNC('day', created_at)::date
            ORDER BY date ASC
        `, [from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), to || new Date()]);

        console.log('Données de ventes récupérées:', rows);
        res.json(rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques de ventes:', error);
        next(new AppError('Erreur lors de la récupération des statistiques de ventes', 500));
    }
});

// GET - Category statistics
router.get('/categories', authMiddleware, async (req, res, next) => {
    if (!req.user.isAdmin) {
        return next(new AppError('Accès non autorisé', 403));
    }

    try {
        console.log('Récupération des statistiques par catégorie...');
        
        const { rows } = await pool.query(`
            SELECT 
                c.name,
                COUNT(DISTINCT oi.order_id) as orders,
                COALESCE(SUM(oi.quantity), 0) as total_sold,
                COALESCE(SUM(oi.quantity * oi.price), 0) as value
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id
            LEFT JOIN order_items oi ON oi.product_id = p.id
            GROUP BY c.id, c.name
            ORDER BY value DESC
        `);

        console.log('Données de catégories récupérées:', rows);
        res.json(rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques par catégorie:', error);
        next(new AppError('Erreur lors de la récupération des statistiques par catégorie', 500));
    }
});

// GET - Brand statistics
router.get('/brands', authMiddleware, async (req, res, next) => {
    if (!req.user.isAdmin) {
        return next(new AppError('Accès non autorisé', 403));
    }

    try {
        console.log('Récupération des statistiques par marque...');
        
        const { rows } = await pool.query(`
            SELECT 
                b.name,
                COUNT(DISTINCT oi.order_id) as orders,
                COALESCE(SUM(oi.quantity), 0) as total_sold,
                COALESCE(SUM(oi.quantity * oi.price), 0) as value
            FROM brands b
            LEFT JOIN products p ON p.brand = b.name
            LEFT JOIN order_items oi ON oi.product_id = p.id
            GROUP BY b.id, b.name
            ORDER BY value DESC
        `);

        console.log('Données de marques récupérées:', rows);
        res.json(rows);
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques par marque:', error);
        next(new AppError('Erreur lors de la récupération des statistiques par marque', 500));
    }
});

module.exports = router; 