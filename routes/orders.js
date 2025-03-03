const express = require('express');
const router = express.Router();
const pool = require('../db');
const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const authMiddleware = require('../middleware/auth');
const { sendOrderConfirmation } = require('../config/mailer');

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

// Validations pour la création et la mise à jour de commandes
const orderValidations = [
    body('items').isArray().withMessage('Les articles de la commande doivent être un tableau'),
    body('items.*.product_id').isInt({ min: 1 }).withMessage('L\'ID du produit doit être un nombre entier positif'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('La quantité doit être un nombre entier positif'),
    body('items.*.variant').isObject().withMessage('Les informations de variant sont requises'),
    body('items.*.variant.size').isString().withMessage('La taille est requise'),
    body('items.*.variant.color').isString().withMessage('La couleur est requise'),
    body('shipping_info').isObject().withMessage('Les informations de livraison sont requises'),
    body('shipping_info.firstName').isString().notEmpty().withMessage('Le prénom est requis'),
    body('shipping_info.lastName').isString().notEmpty().withMessage('Le nom est requis'),
    body('shipping_info.email').isEmail().withMessage('L\'email est invalide'),
    body('shipping_info.phone').matches(/^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/).withMessage('Le numéro de téléphone est invalide'),
    body('shipping_info.address').isString().notEmpty().withMessage('L\'adresse est requise'),
    body('shipping_info.city').isString().notEmpty().withMessage('La ville est requise'),
    body('shipping_info.postalCode').matches(/^\d{5}$/).withMessage('Le code postal doit contenir 5 chiffres'),
    body('shipping_info.country').isString().notEmpty().withMessage('Le pays est requis')
];

// GET les commandes de l'utilisateur connecté
router.get('/me', authMiddleware, async (req, res, next) => {
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

// GET une commande spécifique (route protégée, admin ou utilisateur propriétaire)
router.get('/:id',
    authMiddleware,
    param('id').isInt({ min: 1 }).withMessage('L\'ID de la commande doit être un nombre entier positif'),
    validate([param('id')]),
    async (req, res, next) => {
        try {
            const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
            if (rows.length === 0) {
                return next(new AppError('Commande non trouvée', 404));
            }
            if (!req.user.isAdmin && req.user.id !== rows[0].user_id) {
                return next(new AppError('Accès non autorisé', 403));
            }
            const orderItems = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [req.params.id]);
            res.json({ ...rows[0], items: orderItems.rows });
        } catch (err) {
            next(new AppError('Erreur lors de la récupération de la commande', 500));
        }
    });

// GET toutes les commandes (route protégée, admin seulement)
router.get('/',
    authMiddleware,
    query('page').optional().isInt({ min: 1 }).withMessage('La page doit être un nombre entier positif'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('La limite doit être un nombre entier entre 1 et 100'),
    validate([query('page'), query('limit')]),
    async (req, res, next) => {
        if (!req.user.isAdmin) {
            return next(new AppError('Accès non autorisé', 403));
        }
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            const countQuery = 'SELECT COUNT(*) FROM orders';
            const dataQuery = 'SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2';

            const [countResult, dataResult] = await Promise.all([
                pool.query(countQuery),
                pool.query(dataQuery, [limit, offset])
            ]);

            const totalItems = parseInt(countResult.rows[0].count);
            const totalPages = Math.ceil(totalItems / limit);

            res.json({
                data: dataResult.rows,
                pagination: {
                    currentPage: page,
                    itemsPerPage: limit,
                    totalItems: totalItems,
                    totalPages: totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            });
        } catch (err) {
            next(new AppError('Erreur lors de la récupération des commandes', 500));
        }
    });

// POST une nouvelle commande (route protégée)
router.post('/',
    authMiddleware,
    validate(orderValidations),
    async (req, res, next) => {
        let client;
        try {
            client = await pool.connect();
            const { items, shipping_info } = req.body;
            let totalAmount = 0;

            await client.query('BEGIN');

            // Vérifier le stock et calculer le montant total
            for (const item of items) {
                try {
                    // Verrouiller la ligne du produit pour éviter les conflits
                    const { rows } = await client.query(
                        'SELECT price, variants FROM products WHERE id = $1 FOR UPDATE',
                        [item.product_id]
                    );
                    
                    if (rows.length === 0) {
                        throw new AppError(`Produit avec l'ID ${item.product_id} non trouvé`, 404);
                    }

                    const product = rows[0];
                    
                    // Trouver le variant correspondant
                    const variant = product.variants.find(
                        v => v.size === item.variant.size && v.color === item.variant.color
                    );

                    if (!variant) {
                        throw new AppError(
                            `Variant non trouvé pour le produit ${item.product_id} (taille: ${item.variant.size}, couleur: ${item.variant.color})`,
                            404
                        );
                    }

                    // Vérification du stock du variant
                    if (variant.stock < item.quantity) {
                        throw new AppError(
                            `Stock insuffisant pour le produit ${item.product_id} (${item.variant.color} - ${item.variant.size}). ` +
                            `Stock disponible: ${variant.stock}, Quantité demandée: ${item.quantity}`,
                            400
                        );
                    }

                    // Mettre à jour le stock du variant
                    variant.stock -= item.quantity;

                    // Mettre à jour les variants dans la base de données
                    await client.query(
                        'UPDATE products SET variants = $1 WHERE id = $2',
                        [JSON.stringify(product.variants), item.product_id]
                    );

                    totalAmount += product.price * item.quantity;
                } catch (error) {
                    throw new AppError(error.message || 'Erreur lors de la vérification du produit', error.status || 500);
                }
            }

            // Générer un numéro de commande unique
            const timestamp = Date.now();
            const orderNumber = `ORD-${timestamp}`;

            try {
                // Créer la commande
                const orderResult = await client.query(
                    'INSERT INTO orders (user_id, total_amount, shipping_info, status, payment_status, order_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                    [req.user.id, totalAmount, JSON.stringify(shipping_info), 'pending', 'completed', orderNumber]
                );
                
                const orderId = orderResult.rows[0].id;

                // Créer les items de la commande avec les informations de variant
                for (const item of items) {
                    await client.query(
                        'INSERT INTO order_items (order_id, product_id, quantity, price, variant_info, product_name) VALUES ($1, $2, $3, (SELECT price FROM products WHERE id = $2), $4, (SELECT name FROM products WHERE id = $2))',
                        [orderId, item.product_id, item.quantity, JSON.stringify(item.variant)]
                    );
                }

                await client.query('COMMIT');

                // Récupérer la commande complète
                const finalOrder = await client.query(
                    `SELECT o.*, 
                            json_agg(json_build_object(
                                'product_id', oi.product_id,
                                'quantity', oi.quantity,
                                'price', oi.price,
                                'variant', oi.variant_info
                            )) as items
                     FROM orders o
                     LEFT JOIN order_items oi ON o.id = oi.order_id
                     WHERE o.id = $1
                     GROUP BY o.id`,
                    [orderId]
                );

                // Envoyer l'email de confirmation
                try {
                    await sendOrderConfirmation(finalOrder.rows[0]);
                    console.log('Email de confirmation envoyé avec succès');
                } catch (emailError) {
                    console.error('Erreur lors de l\'envoi de l\'email de confirmation:', emailError);
                }

                res.status(201).json(finalOrder.rows[0]);
            } catch (error) {
                throw new AppError(error.message || 'Erreur lors de la création de la commande', 500);
            }
        } catch (err) {
            if (client) await client.query('ROLLBACK');
            next(err instanceof AppError ? err : new AppError(err.message || 'Erreur serveur interne', 500));
        } finally {
            if (client) client.release();
        }
    }
);

// PUT pour mettre à jour le statut d'une commande (route protégée, admin seulement)
router.put('/:id/status',
    authMiddleware,
    param('id').isInt({ min: 1 }).withMessage('L\'ID de la commande doit être un nombre entier positif'),
    body('status').isIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled']).withMessage('Statut de commande invalide'),
    validate([param('id'), body('status')]),
    async (req, res, next) => {
        if (!req.user.isAdmin) {
            return next(new AppError('Accès non autorisé', 403));
        }
        const { id } = req.params;
        const { status } = req.body;
        try {
            const { rows } = await pool.query(
                'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
                [status, id]
            );
            if (rows.length === 0) {
                return next(new AppError('Commande non trouvée', 404));
            }
            res.json(rows[0]);
        } catch (err) {
            next(new AppError('Erreur lors de la mise à jour du statut de la commande', 500));
        }
    });

// DELETE pour annuler une commande (route protégée, admin ou utilisateur propriétaire)
router.delete('/:id',
    authMiddleware,
    param('id').isInt({ min: 1 }).withMessage('L\'ID de la commande doit être un nombre entier positif'),
    validate([param('id')]),
    async (req, res, next) => {
        const { id } = req.params;
        let client;
        try {
            client = await pool.pool.connect();
            await client.query('BEGIN');

            const { rows } = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
            if (rows.length === 0) {
                throw new AppError('Commande non trouvée', 404);
            }
            if (!req.user.isAdmin && req.user.id !== rows[0].user_id) {
                throw new AppError('Accès non autorisé', 403);
            }
            if (rows[0].status !== 'pending') {
                throw new AppError('Seules les commandes en attente peuvent être annulées', 400);
            }

            // Récupérer les items de la commande avec leurs variants
            const orderItems = await client.query(
                'SELECT * FROM order_items WHERE order_id = $1',
                [id]
            );

            // Restaurer les stocks des variants
            for (const item of orderItems.rows) {
                const { rows: [product] } = await client.query(
                    'SELECT variants FROM products WHERE id = $1 FOR UPDATE',
                    [item.product_id]
                );

                const variant = product.variants.find(
                    v => v.size === item.variant_info.size && v.color === item.variant_info.color
                );

                if (variant) {
                    variant.stock += item.quantity;
                    await client.query(
                        'UPDATE products SET variants = $1 WHERE id = $2',
                        [JSON.stringify(product.variants), item.product_id]
                    );
                }
            }

            await client.query('DELETE FROM order_items WHERE order_id = $1', [id]);
            await client.query('DELETE FROM orders WHERE id = $1', [id]);

            await client.query('COMMIT');
            res.json({ message: 'Commande annulée avec succès' });
        } catch (err) {
            if (client) await client.query('ROLLBACK');
            next(err);
        } finally {
            if (client) client.release();
        }
    });

module.exports = router;

