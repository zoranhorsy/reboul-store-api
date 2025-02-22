const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const bcrypt = require('bcrypt');

// Middleware to check if the user is an admin
const adminMiddleware = (req, res, next) => {
    if (!req.user || !req.user.isAdmin) {
        return next(new AppError('Access denied. Admin privileges required.', 403));
    }
    next();
};

// Create a new user (admin only)
router.post('/users', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const { username, email, password, isAdmin } = req.body;

        // Validation
        if (!username || !email || !password) {
            return next(new AppError('Username, email and password are required', 400));
        }

        // Check if email already exists
        const emailExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailExists.rows.length > 0) {
            return next(new AppError('Email already exists', 400));
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, username, email, is_admin, created_at',
            [username, email, hashedPassword, isAdmin || false]
        );

        // Format response
        const user = result.rows[0];
        res.status(201).json({
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin,
            created_at: user.created_at
        });
    } catch (error) {
        console.error('Error creating user:', error);
        next(new AppError(error.message || 'Error creating user', 500));
    }
});

// Get dashboard stats
router.get('/dashboard/stats', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
        const totalProducts = await pool.query('SELECT COUNT(*) FROM products');
        const totalOrders = await pool.query('SELECT COUNT(*) FROM orders');
        const totalRevenue = await pool.query('SELECT SUM(total_amount) FROM orders');

        res.json({
            totalUsers: totalUsers.rows[0].count,
            totalProducts: totalProducts.rows[0].count,
            totalOrders: totalOrders.rows[0].count,
            totalRevenue: totalRevenue.rows[0].sum || 0
        });
    } catch (error) {
        next(new AppError('Error fetching dashboard stats', 500));
    }
});

// Get recent orders
router.get('/dashboard/recent-orders', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const recentOrders = await pool.query(
            'SELECT * FROM orders ORDER BY created_at DESC LIMIT 5'
        );
        res.json(recentOrders.rows);
    } catch (error) {
        next(new AppError('Error fetching recent orders', 500));
    }
});

// Get top products
router.get('/dashboard/top-products', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const topProducts = await pool.query(
            'SELECT p.id, p.name, SUM(oi.quantity) as total_sold ' +
            'FROM products p ' +
            'JOIN order_items oi ON p.id = oi.product_id ' +
            'GROUP BY p.id, p.name ' +
            'ORDER BY total_sold DESC ' +
            'LIMIT 5'
        );
        res.json(topProducts.rows);
    } catch (error) {
        next(new AppError('Error fetching top products', 500));
    }
});

// Get weekly sales
router.get('/dashboard/weekly-sales', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const weeklySales = await pool.query(
            "SELECT DATE_TRUNC('day', created_at) as date, SUM(total_amount) as total " +
            "FROM orders " +
            "WHERE created_at >= NOW() - INTERVAL '7 days' " +
            "GROUP BY DATE_TRUNC('day', created_at) " +
            "ORDER BY date"
        );
        res.json(weeklySales.rows);
    } catch (error) {
        next(new AppError('Error fetching weekly sales', 500));
    }
});

// Update site settings
router.put('/settings', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const settings = req.body;
        
        // Vérifier si la table settings existe
        const tableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'settings'
            );
        `);
        
        if (!tableExists.rows[0].exists) {
            // Créer la table settings si elle n'existe pas
            await pool.query(`
                CREATE TABLE settings (
                    id SERIAL PRIMARY KEY,
                    site_name VARCHAR(255) NOT NULL,
                    site_description TEXT,
                    contact_email VARCHAR(255),
                    enable_registration BOOLEAN DEFAULT true,
                    enable_checkout BOOLEAN DEFAULT true,
                    maintenance_mode BOOLEAN DEFAULT false,
                    currency VARCHAR(10) DEFAULT 'EUR',
                    tax_rate DECIMAL(5,2) DEFAULT 20.00,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                -- Insérer les paramètres par défaut s'il n'y en a pas
                INSERT INTO settings (
                    site_name, site_description, contact_email, 
                    enable_registration, enable_checkout, maintenance_mode, 
                    currency, tax_rate
                ) VALUES (
                    'Mon E-commerce', 'Description du site', 'contact@example.com',
                    true, true, false,
                    'EUR', 20.00
                );
            `);
        }

        // Mettre à jour les paramètres
        const result = await pool.query(`
            UPDATE settings SET
                site_name = $1,
                site_description = $2,
                contact_email = $3,
                enable_registration = $4,
                enable_checkout = $5,
                maintenance_mode = $6,
                currency = $7,
                tax_rate = $8,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
            RETURNING *
        `, [
            settings.siteName,
            settings.siteDescription,
            settings.contactEmail,
            settings.enableRegistration,
            settings.enableCheckout,
            settings.maintenanceMode,
            settings.currency,
            settings.taxRate
        ]);

        // Convertir les noms de colonnes snake_case en camelCase pour le frontend
        const updatedSettings = {
            siteName: result.rows[0].site_name,
            siteDescription: result.rows[0].site_description,
            contactEmail: result.rows[0].contact_email,
            enableRegistration: result.rows[0].enable_registration,
            enableCheckout: result.rows[0].enable_checkout,
            maintenanceMode: result.rows[0].maintenance_mode,
            currency: result.rows[0].currency,
            taxRate: result.rows[0].tax_rate
        };

        res.json(updatedSettings);
    } catch (error) {
        console.error('Error updating settings:', error);
        next(new AppError('Error updating settings', 500));
    }
});

// Get site settings
router.get('/settings', authMiddleware, adminMiddleware, async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM settings WHERE id = 1');
        
        if (result.rows.length === 0) {
            return next(new AppError('Settings not found', 404));
        }

        // Convertir les noms de colonnes snake_case en camelCase pour le frontend
        const settings = {
            siteName: result.rows[0].site_name,
            siteDescription: result.rows[0].site_description,
            contactEmail: result.rows[0].contact_email,
            enableRegistration: result.rows[0].enable_registration,
            enableCheckout: result.rows[0].enable_checkout,
            maintenanceMode: result.rows[0].maintenance_mode,
            currency: result.rows[0].currency,
            taxRate: result.rows[0].tax_rate
        };

        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        next(new AppError('Error fetching settings', 500));
    }
});

module.exports = router;

