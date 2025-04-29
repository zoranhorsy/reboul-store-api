const express = require('express');
const router = express.Router();
const pool = require('../db');
const { body, param, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const authMiddleware = require('../middleware/auth');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');

// Configuration de multer pour l'upload d'avatar
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/avatars')
    },
    filename: function (req, file, cb) {
        cb(null, `avatar-${Date.now()}${path.extname(file.originalname)}`)
    }
});

const upload = multer({ storage: storage });

// Middleware de validation
const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        const extractedErrors = errors.array().map(err => ({ [err.param]: err.msg }));
        return next(new AppError(JSON.stringify(extractedErrors), 400));
    };
};

// Validations pour la création et la mise à jour d'utilisateurs
const userValidations = [
    body('username').notEmpty().withMessage('Le nom d\'utilisateur est requis'),
    body('email').isEmail().withMessage('L\'email doit être valide'),
    body('password').optional().isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
    body('first_name').optional().isString().withMessage('Le prénom doit être une chaîne de caractères'),
    body('last_name').optional().isString().withMessage('Le nom de famille doit être une chaîne de caractères'),
    body('is_admin').optional().isBoolean().withMessage('is_admin doit être un booléen')
];

// Routes sans paramètres d'abord
// GET tous les utilisateurs (route protégée, admin seulement)
router.get('/', authMiddleware, async (req, res, next) => {
    if (!req.user.isAdmin) {
        return next(new AppError('Accès non autorisé', 403));
    }
    try {
        const { rows } = await pool.query('SELECT id, username, email, first_name, last_name, is_admin, created_at FROM users');
        res.json(rows);
    } catch (err) {
        next(new AppError('Erreur lors de la récupération des utilisateurs', 500));
    }
});

// Récupérer les paramètres de notification
router.get('/notification-settings', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('Fetching notification settings for user:', userId);
        
        if (!userId || isNaN(userId)) {
            return res.status(400).json({ 
                status: 'fail',
                message: 'ID utilisateur invalide'
            });
        }
        
        // Vérifier si la colonne existe
        const checkColumn = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'notification_settings'
        `);
        
        if (checkColumn.rows.length === 0) {
            // Si la colonne n'existe pas, la créer
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS notification_settings JSONB 
                DEFAULT '{"email": true, "push": false, "marketing": false, "security": true}'
            `);
        }
        
        const { rows } = await pool.query(
            'SELECT notification_settings FROM users WHERE id = $1',
            [userId]
        );
        
        const settings = rows[0]?.notification_settings || {
            email: true,
            push: false,
            marketing: false,
            security: true
        };
        
        console.log('Retrieved settings:', settings);
        res.json(settings);
    } catch (error) {
        console.error('Erreur lors de la récupération des paramètres de notification:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Mettre à jour les paramètres de notification
router.put('/notification-settings', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!userId || isNaN(userId)) {
            return res.status(400).json({ 
                status: 'fail',
                message: 'ID utilisateur invalide'
            });
        }

        const settings = {
            email: Boolean(req.body.email),
            push: Boolean(req.body.push),
            marketing: Boolean(req.body.marketing),
            security: Boolean(req.body.security)
        };
        
        console.log('Updating settings for user:', userId, 'with:', settings);
        
        // Vérifier si la colonne existe
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'notification_settings'
        `);
        
        if (checkColumn.rows.length === 0) {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS notification_settings JSONB 
                DEFAULT '{"email": true, "push": false, "marketing": false, "security": true}'
            `);
        }
        
        const { rows } = await pool.query(
            'UPDATE users SET notification_settings = $1::jsonb WHERE id = $2 RETURNING notification_settings',
            [settings, userId]
        );
        
        console.log('Updated settings:', rows[0]?.notification_settings);
        res.json(rows[0]?.notification_settings);
    } catch (error) {
        console.error('Erreur détaillée:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Routes pour les favoris
router.get('/favorites', authMiddleware, async (req, res) => {
    try {
        console.log('Récupération des favoris - User complet:', req.user);
        
        const userId = req.user.id;
        console.log('userId récupéré:', userId);

        if (!userId) {
            console.log('Erreur: userId manquant dans req.user:', req.user);
            return res.status(400).json({ 
                message: 'Utilisateur non authentifié'
            });
        }

        // Récupérer les favoris des produits normaux
        const regularProducts = await pool.query(`
            SELECT 
                f.id as favorite_id,
                f.is_corner_product,
                f.created_at as favorited_at,
                p.*
            FROM favorites f
            JOIN products p ON f.product_id = p.id
            WHERE f.user_id = $1 AND f.is_corner_product = false
        `, [userId]);

        // Récupérer les favoris des produits The Corner
        const cornerProducts = await pool.query(`
            SELECT 
                f.id as favorite_id,
                f.is_corner_product,
                f.created_at as favorited_at,
                cp.*
            FROM favorites f
            JOIN corner_products cp ON f.corner_product_id = cp.id
            WHERE f.user_id = $1 AND f.is_corner_product = true
        `, [userId]);

        // Combiner les résultats
        const allProducts = [
            ...regularProducts.rows.map(row => ({
                ...row,
                is_corner_product: false
            })),
            ...cornerProducts.rows.map(row => ({
                ...row,
                is_corner_product: true
            }))
        ].sort((a, b) => new Date(b.favorited_at).getTime() - new Date(a.favorited_at).getTime());

        console.log('Favoris trouvés:', allProducts.length);
        res.json(allProducts);
    } catch (error) {
        console.error('Erreur détaillée lors de la récupération des favoris:', error);
        res.status(500).json({ 
            message: 'Erreur serveur',
            error: error.message
        });
    }
});

// Vérifier si un produit est dans les favoris
router.get('/favorites/:productId', authMiddleware, async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.user.id;

        const { rows } = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM favorites WHERE user_id = $1 AND product_id = $2)',
            [userId, productId]
        );

        res.json({ isFavorite: rows[0].exists });
    } catch (error) {
        console.error('Erreur lors de la vérification des favoris:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

router.post('/favorites', authMiddleware, async (req, res) => {
    try {
        console.log('Tentative d\'ajout aux favoris');
        console.log('User:', req.user);
        console.log('Body:', req.body);
        
        const { product_id, corner_product_id, is_corner_product } = req.body;
        const userId = req.user.id;

        // Vérifier qu'au moins un ID est fourni
        if (!product_id && !corner_product_id) {
            console.log('Erreur: aucun ID de produit fourni');
            return res.status(400).json({ message: 'Un ID de produit est requis' });
        }

        if (!userId) {
            console.log('Erreur: userId manquant');
            return res.status(400).json({ message: 'Utilisateur non authentifié' });
        }

        // Vérifier la cohérence des données
        if (is_corner_product && !corner_product_id) {
            return res.status(400).json({ message: 'corner_product_id est requis pour un produit The Corner' });
        }
        if (!is_corner_product && !product_id) {
            return res.status(400).json({ message: 'product_id est requis pour un produit normal' });
        }

        // Vérifier si le produit existe dans la bonne table
        const productExists = await pool.query(
            is_corner_product 
                ? 'SELECT id FROM corner_products WHERE id = $1'
                : 'SELECT id FROM products WHERE id = $1',
            [is_corner_product ? corner_product_id : product_id]
        );

        if (productExists.rows.length === 0) {
            return res.status(404).json({ 
                message: is_corner_product 
                    ? 'Produit The Corner non trouvé' 
                    : 'Produit non trouvé'
            });
        }

        // Insérer dans la table favorites avec la nouvelle structure
        const { rows } = await pool.query(
            `INSERT INTO favorites (
                user_id, 
                product_id, 
                corner_product_id, 
                is_corner_product
            ) VALUES (
                $1, 
                $2,
                $3,
                $4
            ) RETURNING *`,
            [
                userId,
                is_corner_product ? null : product_id,
                is_corner_product ? corner_product_id : null,
                is_corner_product || false
            ]
        );

        console.log('Résultat de l\'insertion:', rows[0]);
        res.status(201).json({
            success: true,
            data: rows[0]
        });
    } catch (error) {
        console.error('Erreur détaillée lors de l\'ajout aux favoris:', error);
        if (error.code === '23505') {
            res.status(400).json({ message: 'Ce produit est déjà dans vos favoris' });
        } else {
            console.error('Erreur lors de l\'ajout aux favoris:', error);
            res.status(500).json({ message: 'Erreur serveur' });
        }
    }
});

router.delete('/favorites', authMiddleware, async (req, res) => {
    try {
        const { product_id, is_corner_product } = req.query;
        const userId = req.user.id;

        if (!product_id) {
            return res.status(400).json({ message: 'product_id est requis' });
        }

        // Supprimer le favori en tenant compte du type de produit
        const { rows } = await pool.query(
            `DELETE FROM favorites 
            WHERE user_id = $1 
            AND (
                (is_corner_product = true AND corner_product_id = $2) OR
                (is_corner_product = false AND product_id = $2)
            )
            RETURNING *`,
            [userId, product_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Favori non trouvé' });
        }

        res.json({ 
            success: true,
            message: 'Produit retiré des favoris',
            data: rows[0]
        });
    } catch (error) {
        console.error('Erreur lors de la suppression des favoris:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Routes avec paramètres ensuite
router.get('/:id',
    authMiddleware,
    param('id').isInt({ min: 1 }).withMessage('L\'ID de l\'utilisateur doit être un nombre entier positif'),
    validate([param('id')]),
    async (req, res, next) => {
        const userId = parseInt(req.params.id);
        if (!req.user.isAdmin && req.user.userId !== userId) {
            return next(new AppError('Accès non autorisé', 403));
        }
        try {
            const { rows } = await pool.query('SELECT id, username, email, first_name, last_name, is_admin, created_at FROM users WHERE id = $1', [userId]);
            if (rows.length === 0) {
                return next(new AppError('Utilisateur non trouvé', 404));
            }
            res.json(rows[0]);
        } catch (err) {
            next(new AppError('Erreur lors de la récupération de l\'utilisateur', 500));
        }
    });

// GET un utilisateur spécifique (route protégée, admin ou utilisateur lui-même)
router.get('/:id',
    authMiddleware,
    param('id').isInt({ min: 1 }).withMessage('L\'ID de l\'utilisateur doit être un nombre entier positif'),
    validate([param('id')]),
    async (req, res, next) => {
        const userId = parseInt(req.params.id);
        if (!req.user.isAdmin && req.user.userId !== userId) {
            return next(new AppError('Accès non autorisé', 403));
        }
        try {
            const { rows } = await pool.query('SELECT id, username, email, first_name, last_name, is_admin, created_at FROM users WHERE id = $1', [userId]);
            if (rows.length === 0) {
                return next(new AppError('Utilisateur non trouvé', 404));
            }
            res.json(rows[0]);
        } catch (err) {
            next(new AppError('Erreur lors de la récupération de l\'utilisateur', 500));
        }
    });

// PUT pour mettre à jour un utilisateur (route protégée, admin ou utilisateur lui-même)
router.put('/:id',
    authMiddleware,
    param('id').isInt({ min: 1 }).withMessage('L\'ID de l\'utilisateur doit être un nombre entier positif'),
    validate([...userValidations, param('id')]),
    async (req, res, next) => {
        const { id } = req.params;
        const userId = parseInt(id);
        if (!req.user.isAdmin && req.user.userId !== userId) {
            return next(new AppError('Accès non autorisé', 403));
        }
        const { username, email, password, first_name, last_name, is_admin } = req.body;
        try {
            let hashedPassword;
            if (password) {
                hashedPassword = await bcrypt.hash(password, 10);
            }
            const { rows } = await pool.query(
                'UPDATE users SET username = COALESCE($1, username), email = COALESCE($2, email), password_hash = COALESCE($3, password_hash), first_name = COALESCE($4, first_name), last_name = COALESCE($5, last_name), is_admin = COALESCE($6, is_admin) WHERE id = $7 RETURNING id, username, email, first_name, last_name, is_admin, created_at',
                [username, email, hashedPassword, first_name, last_name, is_admin, id]
            );
            if (rows.length === 0) {
                return next(new AppError('Utilisateur non trouvé', 404));
            }
            res.json(rows[0]);
        } catch (err) {
            if (err.code === '23505') {
                return next(new AppError('Le nom d\'utilisateur ou l\'email est déjà utilisé', 400));
            }
            next(new AppError('Erreur lors de la mise à jour de l\'utilisateur', 500));
        }
    });

// DELETE pour supprimer un utilisateur (route protégée, admin seulement)
router.delete('/:id',
    authMiddleware,
    param('id').isInt({ min: 1 }).withMessage('L\'ID de l\'utilisateur doit être un nombre entier positif'),
    validate([param('id')]),
    async (req, res, next) => {
        if (!req.user.isAdmin) {
            return next(new AppError('Accès non autorisé', 403));
        }
        const { id } = req.params;
        try {
            const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, username, email', [id]);
            if (rows.length === 0) {
                return next(new AppError('Utilisateur non trouvé', 404));
            }
            res.json({ message: 'Utilisateur supprimé avec succès', deletedUser: rows[0] });
        } catch (err) {
            next(new AppError('Erreur lors de la suppression de l\'utilisateur', 500));
        }
    });

router.put('/users/:id/password', authMiddleware, async (req, res, next) => {
    if (!req.user.is_admin) {
        return next(new AppError('Accès non autorisé', 403));
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    try {
        // Hasher le nouveau mot de passe
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Mettre à jour le mot de passe dans la base de données
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, id]);

        res.json({ message: 'Mot de passe mis à jour avec succès' });
    } catch (err) {
        console.error('Erreur lors de la mise à jour du mot de passe:', err);
        next(new AppError('Erreur lors de la mise à jour du mot de passe', 500));
    }
});

// Récupérer le profil de l'utilisateur connecté
router.get('/user/profile', authMiddleware, async (req, res) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, name, email, avatar_url, created_at FROM users WHERE id = $1',
            [req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Utilisateur non trouvé' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Erreur lors de la récupération du profil:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Mettre à jour le profil utilisateur
router.put('/user/profile', authMiddleware, async (req, res) => {
    try {
        const { name, email } = req.body;
        
        // Vérifier si l'email est déjà utilisé
        if (email) {
            const emailCheck = await pool.query(
                'SELECT id FROM users WHERE email = $1 AND id != $2',
                [email, req.user.id]
            );
            if (emailCheck.rows.length > 0) {
                return res.status(400).json({ message: 'Cet email est déjà utilisé' });
            }
        }

        const { rows } = await pool.query(
            'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), updated_at = NOW() WHERE id = $3 RETURNING id, name, email, avatar_url',
            [name, email, req.user.id]
        );

        res.json(rows[0]);
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Upload d'avatar
router.post('/user/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Aucun fichier uploadé' });
        }

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const { rows } = await pool.query(
            'UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING avatar_url',
            [avatarUrl, req.user.id]
        );

        res.json({ avatarUrl: rows[0].avatar_url });
    } catch (error) {
        console.error('Erreur lors de l\'upload de l\'avatar:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Supprimer le compte utilisateur
router.delete('/user/account', authMiddleware, async (req, res) => {
    try {
        // Vérifier si l'utilisateur a des commandes en cours
        const { rows: orderCheck } = await pool.query(
            'SELECT EXISTS(SELECT 1 FROM orders WHERE user_id = $1 AND status NOT IN (\'delivered\', \'cancelled\'))',
            [req.user.id]
        );

        if (orderCheck[0].exists) {
            return res.status(400).json({
                message: 'Impossible de supprimer le compte : vous avez des commandes en cours'
            });
        }

        await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
        res.json({ message: 'Compte supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du compte:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// Récupérer les commandes de l'utilisateur connecté
router.get('/orders/user', authMiddleware, async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            'SELECT o.*, json_agg(json_build_object(\'id\', oi.id, \'product_id\', oi.product_id, \'quantity\', oi.quantity, \'price\', oi.price)) as items FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        next(new AppError('Erreur lors de la récupération des commandes', 500));
    }
});

// Récupérer les avis de l'utilisateur connecté
router.get('/reviews/user', authMiddleware, async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            'SELECT r.*, p.name as product_name FROM reviews r JOIN products p ON r.product_id = p.id WHERE r.user_id = $1 ORDER BY r.created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        next(new AppError('Erreur lors de la récupération des avis', 500));
    }
});

// GET user addresses
router.get('/addresses', authMiddleware, async (req, res) => {
    try {
        console.log('Fetching addresses for user:', req.user);
        
        // Check if addresses table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'addresses'
            );
        `);
        
        if (!tableCheck.rows[0].exists) {
            console.log('Creating addresses table...');
            // Create addresses table if it doesn't exist
            await pool.query(`
                CREATE TABLE addresses (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    street TEXT NOT NULL,
                    city TEXT NOT NULL,
                    postal_code TEXT NOT NULL,
                    country TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            console.log('Addresses table created successfully');
        }

        const userId = req.user.id;
        console.log('Using user ID:', userId);

        const { rows } = await pool.query(
            'SELECT * FROM addresses WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        
        console.log('Found addresses:', rows.length);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des adresses' });
    }
});

// POST new address
router.post('/addresses', authMiddleware, async (req, res) => {
    try {
        const { street, city, postal_code, country } = req.body;
        const userId = req.user.id;
        
        if (!street || !city || !postal_code || !country) {
            return res.status(400).json({ message: 'Tous les champs sont requis' });
        }

        const { rows } = await pool.query(
            'INSERT INTO addresses (user_id, street, city, postal_code, country) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [userId, street, city, postal_code, country]
        );
        
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error creating address:', error);
        res.status(500).json({ message: 'Erreur lors de la création de l\'adresse' });
    }
});

// PUT update address
router.put('/addresses/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { street, city, postal_code, country } = req.body;
        const userId = req.user.id;
        
        if (!street || !city || !postal_code || !country) {
            return res.status(400).json({ message: 'Tous les champs sont requis' });
        }

        const { rows } = await pool.query(
            'UPDATE addresses SET street = $1, city = $2, postal_code = $3, country = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 AND user_id = $6 RETURNING *',
            [street, city, postal_code, country, id, userId]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Adresse non trouvée' });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating address:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'adresse' });
    }
});

// DELETE address
router.delete('/addresses/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        
        const { rows } = await pool.query(
            'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, userId]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Adresse non trouvée' });
        }
        
        res.json({ message: 'Adresse supprimée avec succès' });
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression de l\'adresse' });
    }
});

// Endpoint pour mettre à jour le rôle d'un utilisateur (admin seulement)
router.put('/:id/role', authMiddleware, async (req, res, next) => {
    try {
        // Vérifier si l'utilisateur est admin
        if (!req.user.isAdmin) {
            return next(new AppError('Accès non autorisé', 403));
        }

        const { id } = req.params;
        const { is_admin } = req.body;

        // Vérifier si le paramètre is_admin est présent et est un booléen
        if (typeof is_admin !== 'boolean') {
            return next(new AppError('Le paramètre is_admin doit être un booléen', 400));
        }

        // Mettre à jour le rôle de l'utilisateur
        const { rows } = await pool.query(
            'UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING id, username, email, is_admin',
            [is_admin, id]
        );

        if (rows.length === 0) {
            return next(new AppError('Utilisateur non trouvé', 404));
        }

        // Retourner l'utilisateur mis à jour
        res.json(rows[0]);
    } catch (err) {
        console.error('Erreur lors de la mise à jour du rôle:', err);
        next(new AppError('Erreur lors de la mise à jour du rôle utilisateur', 500));
    }
});

module.exports = router;