const express = require('express');
const router = express.Router();
const pool = require('../db');
const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const authMiddleware = require('../middleware/auth');
const { sendOrderConfirmation, sendOrderStatusNotification } = require('../config/mailer');

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
    body('items.*.variant.color').isString().withMessage('La couleur est requise')
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
            const orderItems = await pool.query(`
                SELECT *, 
                CASE 
                    WHEN product_id IS NOT NULL THEN product_id
                    WHEN corner_product_id IS NOT NULL THEN corner_product_id  
                    WHEN sneakers_product_id IS NOT NULL THEN sneakers_product_id
                    WHEN minots_product_id IS NOT NULL THEN minots_product_id
                    ELSE NULL
                END as real_product_id,
                CASE 
                    WHEN product_id IS NOT NULL THEN 'products'
                    WHEN corner_product_id IS NOT NULL THEN 'corner_products'  
                    WHEN sneakers_product_id IS NOT NULL THEN 'sneakers_products'
                    WHEN minots_product_id IS NOT NULL THEN 'minots_products'
                    ELSE NULL
                END as product_table
                FROM order_items 
                WHERE order_id = $1
            `, [req.params.id]);
            
            // Ajouter real_product_id et table info pour le frontend
            const itemsWithCorrectIds = orderItems.rows.map(item => ({
                ...item,
                product_id: item.real_product_id || item.product_id,
                store_table: item.product_table
            }));
            
            res.json({ ...rows[0], items: itemsWithCorrectIds });
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
            client = await pool.pool.connect();
            const { items, shipping_info } = req.body;
            let totalAmount = 0;

            await client.query('BEGIN');

            // Vérifier le stock et calculer le montant total
            for (const item of items) {
                console.log('Vérification du produit:', item.product_id);
                console.log('Variant demandé:', item.variant);

                // Verrouiller la ligne du produit pour éviter les conflits
                const { rows } = await client.query(
                    'SELECT price, variants FROM products WHERE id = $1 FOR UPDATE',
                    [item.product_id]
                );
                
                if (rows.length === 0) {
                    console.error('Produit non trouvé:', item.product_id);
                    throw new AppError(`Produit avec l'ID ${item.product_id} non trouvé`, 404);
                }

                const product = rows[0];
                console.log('Produit trouvé:', {
                    id: item.product_id,
                    price: product.price,
                    variants: product.variants
                });
                
                // Trouver le variant correspondant
                const variant = product.variants.find(
                    v => String(v.size) === String(item.variant.size) && 
                         String(v.color).toLowerCase() === String(item.variant.color).toLowerCase()
                );

                if (!variant) {
                    console.error('Variant non trouvé:', {
                        productId: item.product_id,
                        requestedSize: item.variant.size,
                        requestedColor: item.variant.color,
                        availableVariants: product.variants,
                        sizeType: typeof item.variant.size,
                        colorType: typeof item.variant.color
                    });
                    throw new AppError(
                        `Variant non trouvé pour le produit ${item.product_id} (taille: ${item.variant.size}, couleur: ${item.variant.color})`,
                        404
                    );
                }

                console.log('Variant trouvé:', variant);

                // Vérification du stock du variant
                if (variant.stock < item.quantity) {
                    console.error('Stock insuffisant:', {
                        productId: item.product_id,
                        variant: variant,
                        requestedQuantity: item.quantity,
                        availableStock: variant.stock
                    });
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
            }

            // Générer un numéro de commande unique
            const timestamp = Date.now();
            const orderNumber = `ORD-${timestamp}`;

            // Créer la commande
            const orderResult = await client.query(
                'INSERT INTO orders (user_id, total_amount, shipping_info, status, payment_status, order_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [req.user.id, totalAmount, shipping_info, 'pending', 'completed', orderNumber]
            );
            
            const orderId = orderResult.rows[0].id;

            // Créer les items de la commande avec les informations de variant
            for (const item of items) {
                await client.query(
                    'INSERT INTO order_items (order_id, product_id, product_name, quantity, price, variant_info) VALUES ($1, $2, $3, $4, (SELECT price FROM products WHERE id = $2), $5)',
                    [orderId, item.product_id, item.product_name, item.quantity, JSON.stringify(item.variant)]
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

        } catch (err) {
            if (client) await client.query('ROLLBACK');
            next(err);
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
    body('tracking_number').optional().isString().withMessage('Le numéro de suivi doit être une chaîne de caractères'),
    body('carrier').optional().isString().withMessage('Le transporteur doit être une chaîne de caractères'),
    validate([param('id'), body('status'), body('tracking_number'), body('carrier')]),
    async (req, res, next) => {
        if (!req.user.isAdmin) {
            return next(new AppError('Accès non autorisé', 403));
        }
        const { id } = req.params;
        const { status, tracking_number, carrier } = req.body;
        
        try {
            // Récupérer la commande actuelle pour connaître l'ancien statut
            const currentOrderQuery = await pool.query(
                'SELECT * FROM orders WHERE id = $1',
                [id]
            );
            
            if (currentOrderQuery.rows.length === 0) {
                return next(new AppError('Commande non trouvée', 404));
            }
            
            const currentOrder = currentOrderQuery.rows[0];
            const previousStatus = currentOrder.status;
            
            // Mettre à jour le statut et optionnellement le numéro de suivi
            const updateQuery = tracking_number 
                ? 'UPDATE orders SET status = $1, tracking_number = $2, carrier = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *'
                : 'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *';
            
            const updateParams = tracking_number 
                ? [status, tracking_number, carrier || null, id]
                : [status, id];
            
            const { rows } = await pool.query(updateQuery, updateParams);
            
            const updatedOrder = rows[0];
            
            // Envoyer un email de notification si le statut a changé
            if (previousStatus !== status) {
                try {
                    console.log(`📧 Changement de statut détecté: ${previousStatus} -> ${status} pour la commande ${updatedOrder.order_number}`);
                    
                    // Envoyer l'email de notification de changement de statut
                    await sendOrderStatusNotification(updatedOrder, previousStatus, status);
                    
                    console.log(`✅ Email de notification envoyé avec succès pour la commande ${updatedOrder.order_number}`);
                } catch (emailError) {
                    console.error('❌ Erreur lors de l\'envoi de l\'email de notification:', emailError);
                    // Ne pas faire échouer la requête si l'email échoue
                }
            }
            
            // Si un numéro de suivi est fourni et que le statut est "shipped", envoyer aussi un email de suivi
            let trackingEmailSent = false;
            if (tracking_number && status === 'shipped') {
                try {
                    const { sendTrackingNotification } = require('../config/mailer');
                    await sendTrackingNotification(updatedOrder, tracking_number, carrier);
                    console.log(`✅ Email de suivi envoyé avec succès pour la commande ${updatedOrder.order_number}`);
                    trackingEmailSent = true;
                } catch (trackingEmailError) {
                    console.error('❌ Erreur lors de l\'envoi de l\'email de suivi:', trackingEmailError);
                    // Ne pas faire échouer la requête si l'email échoue
                }
            }
            
            res.json({
                ...updatedOrder,
                message: 'Statut mis à jour avec succès',
                emailSent: previousStatus !== status,
                trackingEmailSent
            });
            
        } catch (err) {
            console.error('Erreur lors de la mise à jour du statut:', err);
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

/**
 * Associe les commandes sans user_id à des utilisateurs existants en se basant sur l'email
 * @route GET /api/orders/associate-orphan-orders
 * @access Private (admin only)
 */
router.get('/associate-orphan-orders', authMiddleware, async (req, res) => {
  const client = await pool.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Rechercher les commandes sans user_id mais avec un email dans shipping_info
    const orphanOrdersQuery = await client.query(`
      SELECT o.id, o.order_number, o.shipping_info->>'email' as email 
      FROM orders o 
      WHERE o.user_id IS NULL 
      AND o.shipping_info->>'email' IS NOT NULL
    `);
    
    const orphanOrders = orphanOrdersQuery.rows;
    console.log(`Trouvé ${orphanOrders.length} commandes orphelines à associer`);
    
    let associatedCount = 0;
    
    // Pour chaque commande orpheline, essayer de trouver un utilisateur correspondant
    for (const order of orphanOrders) {
      if (!order.email) continue;
      
      // Rechercher l'utilisateur par email
      const userQuery = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [order.email]
      );
      
      if (userQuery.rows.length > 0) {
        const userId = userQuery.rows[0].id;
        
        // Associer la commande à l'utilisateur
        await client.query(
          'UPDATE orders SET user_id = $1 WHERE id = $2',
          [userId, order.id]
        );
        
        console.log(`Commande ${order.order_number} associée à l'utilisateur ${userId}`);
        associatedCount++;
      }
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `${associatedCount} commandes ont été associées à des utilisateurs existants`,
      total: orphanOrders.length,
      associated: associatedCount
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur lors de l\'association des commandes orphelines:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de l\'association des commandes orphelines',
      error: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * Planifie l'exécution périodique de l'association des commandes orphelines
 */
let associationInterval;

// Fonction pour associer automatiquement les commandes orphelines
async function associateOrphanOrders() {
  const client = await pool.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Rechercher les commandes sans user_id mais avec un email dans shipping_info
    const orphanOrdersQuery = await client.query(`
      SELECT o.id, o.order_number, o.shipping_info->>'email' as email,
             o.payment_data->>'customerEmail' as payment_email
      FROM orders o 
      WHERE o.user_id IS NULL 
      AND (o.shipping_info->>'email' IS NOT NULL OR o.payment_data->>'customerEmail' IS NOT NULL)
    `);
    
    const orphanOrders = orphanOrdersQuery.rows;
    
    if (orphanOrders.length > 0) {
      console.log(`Traitement automatique de ${orphanOrders.length} commandes orphelines`);
    }
    
    let associatedCount = 0;
    
    // Pour chaque commande orpheline, essayer de trouver un utilisateur correspondant
    for (const order of orphanOrders) {
      const email = order.email || order.payment_email;
      if (!email) continue;
      
      // Rechercher l'utilisateur par email
      const userQuery = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (userQuery.rows.length > 0) {
        const userId = userQuery.rows[0].id;
        
        // Associer la commande à l'utilisateur
        await client.query(
          'UPDATE orders SET user_id = $1 WHERE id = $2',
          [userId, order.id]
        );
        
        console.log(`[Auto] Commande ${order.order_number} associée à l'utilisateur ${userId}`);
        associatedCount++;
      }
    }
    
    await client.query('COMMIT');
    
    if (associatedCount > 0) {
      console.log(`[Auto] ${associatedCount} commandes ont été associées à des utilisateurs existants`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Auto] Erreur lors de l\'association des commandes orphelines:', error);
  } finally {
    client.release();
  }
}

// Démarrer le processus d'association automatique (toutes les 24 heures)
if (process.env.ENABLE_AUTO_ORDER_ASSOCIATION === 'true') {
  associationInterval = setInterval(associateOrphanOrders, 24 * 60 * 60 * 1000);
  console.log('Processus d\'association automatique des commandes orphelines activé');
  
  // Exécuter immédiatement au démarrage du serveur
  associateOrphanOrders().catch(err => {
    console.error('Erreur lors de l\'association initiale des commandes orphelines:', err);
  });
}

/**
 * Route pour réparer les adresses manquantes dans les commandes
 * @route GET /api/orders/fix-missing-addresses
 * @access Private (admin only)
 */
router.get('/fix-missing-addresses', authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé'
    });
  }
  
  const client = await pool.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Récupérer toutes les commandes avec des adresses manquantes
    const ordersWithMissingAddressQuery = await client.query(`
      SELECT o.id, o.order_number, o.shipping_info, o.payment_data, o.customer_info
      FROM orders o 
      WHERE (
        o.shipping_info IS NULL OR 
        o.shipping_info->>'address' IS NULL OR 
        o.shipping_info->>'hasAddress' = 'false' OR
        o.shipping_info->>'isValid' = 'false'
      )
      ORDER BY o.created_at DESC
    `);
    
    const ordersToFix = ordersWithMissingAddressQuery.rows;
    console.log(`Trouvé ${ordersToFix.length} commandes avec des adresses manquantes à réparer`);
    
    let fixedCount = 0;
    
    for (const order of ordersToFix) {
      // Récupérer les informations d'adresse de différentes sources
      const stripeAddress = 
        order.customer_info?.address || 
        order.payment_data?.customerAddress || 
        {};
      
      // Si nous avons une adresse valide dans les données Stripe
      if (stripeAddress.line1 && stripeAddress.city && stripeAddress.postal_code) {
        // Préparer les nouvelles informations d'expédition
        let updatedShippingInfo = order.shipping_info || {};
        
        // Mettre à jour les informations d'adresse
        updatedShippingInfo = {
          ...updatedShippingInfo,
          address: stripeAddress.line1,
          addressLine2: stripeAddress.line2,
          city: stripeAddress.city,
          postalCode: stripeAddress.postal_code,
          country: stripeAddress.country,
          hasAddress: true,
          addressType: 'shipping',
          isValid: true,
          // Conserver le type de livraison existant ou utiliser une valeur par défaut
          deliveryType: updatedShippingInfo.deliveryType || 
                        order.payment_data?.deliveryType || 
                        'standard'
        };
        
        console.log(`Mise à jour des informations d'adresse pour la commande ${order.order_number}:`, 
                   JSON.stringify(updatedShippingInfo, null, 2));
        
        // Mettre à jour la commande avec les nouvelles informations d'expédition
        await client.query(
          'UPDATE orders SET shipping_info = $1 WHERE id = $2',
          [updatedShippingInfo, order.id]
        );
        
        fixedCount++;
      }
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `${fixedCount} commandes ont été réparées sur ${ordersToFix.length} commandes avec des adresses manquantes`,
      totalOrders: ordersToFix.length,
      fixedOrders: fixedCount
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur lors de la réparation des adresses manquantes:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la réparation des adresses manquantes',
      error: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * Route d'urgence pour corriger toutes les adresses manquantes avec des valeurs par défaut
 * @route GET /api/orders/emergency-fix-addresses
 * @access Private (admin only)
 */
router.get('/emergency-fix-addresses', authMiddleware, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé'
    });
  }
  
  const client = await pool.pool.connect();
  try {
    await client.query('BEGIN');
    
    // Mise à jour de toutes les commandes pour standardiser le format d'adresse
    const updateResult = await client.query(`
      UPDATE orders
      SET shipping_info = jsonb_set(
        COALESCE(shipping_info, '{}'::jsonb),
        '{hasAddress}',
        'true'::jsonb
      )
    `);
    
    // Deuxième mise à jour pour ajouter d'autres champs nécessaires
    await client.query(`
      UPDATE orders
      SET shipping_info = jsonb_set(
        jsonb_set(
          jsonb_set(
            shipping_info, 
            '{addressType}', 
            '"shipping"'::jsonb
          ),
          '{isValid}',
          'true'::jsonb
        ),
        '{address}',
        COALESCE(shipping_info->'address', '"Non spécifiée"'::jsonb)
      )
      WHERE shipping_info->'address' IS NULL OR shipping_info->>'address' = 'null'
    `);
    
    console.log('Correction d\'urgence des adresses terminée');
    
    // Compter les commandes corrigées
    const countResult = await client.query(`
      SELECT COUNT(*) FROM orders
    `);
    
    const totalOrders = parseInt(countResult.rows[0].count);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: `Correction d'urgence appliquée à ${totalOrders} commandes`,
      totalOrders
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur lors de la correction d\'urgence des adresses:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la correction d\'urgence des adresses',
      error: error.message
    });
  } finally {
    client.release();
  }
});

// POST pour renvoyer un email de suivi (route protégée, admin seulement)
router.post('/:id/send-tracking-email',
    authMiddleware,
    param('id').isInt({ min: 1 }).withMessage('L\'ID de la commande doit être un nombre entier positif'),
    body('tracking_number').optional().isString().withMessage('Le numéro de suivi doit être une chaîne de caractères'),
    body('carrier').optional().isString().withMessage('Le transporteur doit être une chaîne de caractères'),
    validate([param('id'), body('tracking_number'), body('carrier')]),
    async (req, res, next) => {
        if (!req.user.isAdmin) {
            return next(new AppError('Accès non autorisé', 403));
        }
        
        const { id } = req.params;
        const { tracking_number, carrier } = req.body;
        
        try {
            // Récupérer la commande
            const { rows } = await pool.query(
                'SELECT * FROM orders WHERE id = $1',
                [id]
            );
            
            if (rows.length === 0) {
                return next(new AppError('Commande non trouvée', 404));
            }
            
            const order = rows[0];
            
            // Utiliser le numéro de suivi fourni ou celui de la commande
            const trackingNumberToUse = tracking_number || order.tracking_number;
            
            if (!trackingNumberToUse) {
                return next(new AppError('Aucun numéro de suivi disponible', 400));
            }
            
            // Envoyer l'email de suivi
            const { sendTrackingNotification } = require('../config/mailer');
            await sendTrackingNotification(order, trackingNumberToUse, carrier || order.carrier);
            
            console.log(`Email de suivi renvoyé avec succès pour la commande ${order.order_number}`);
            
            res.json({
                success: true,
                message: 'Email de suivi envoyé avec succès',
                order_number: order.order_number,
                tracking_number: trackingNumberToUse
            });
            
        } catch (error) {
            console.error('Erreur lors de l\'envoi de l\'email de suivi:', error);
            next(new AppError('Erreur lors de l\'envoi de l\'email de suivi', 500));
        }
    });

// POST pour envoyer un email de notification de commande (route protégée, admin seulement)  
router.post('/send-email',
    authMiddleware,
    [
        body('order_id').notEmpty().withMessage('order_id est requis'),
        body('order_number').notEmpty().withMessage('order_number est requis'),
        body('customer_email').isEmail().withMessage('customer_email doit être un email valide'),
        body('customer_name').optional().isString(),
        body('total_amount').isFloat({ min: 0 }).withMessage('total_amount doit être un nombre positif'),
        body('items').isArray().withMessage('items doit être un tableau'),
        body('type').isIn(['pending', 'confirmed', 'cancelled']).withMessage('type doit être pending, confirmed ou cancelled')
    ],
    validate([
        body('order_id'), 
        body('order_number'), 
        body('customer_email'), 
        body('total_amount'), 
        body('items'), 
        body('type')
    ]),
    async (req, res, next) => {
        if (!req.user.isAdmin) {
            return next(new AppError('Accès non autorisé', 403));
        }
        
        const { 
            order_id, 
            order_number, 
            customer_email, 
            customer_name, 
            total_amount, 
            items, 
            type 
        } = req.body;
        
        try {
            console.log(`📧 Envoi d'email ${type} pour la commande #${order_id} à ${customer_email}`);
            
            // Préparer les données de la commande pour l'email
            const orderData = {
                id: parseInt(order_id),
                order_number,
                total_amount: parseFloat(total_amount),
                shipping_info: {
                    email: customer_email,
                    firstName: customer_name || 'Client'
                },
                items: items || []
            };
            
            // Envoyer l'email selon le type
            const { sendOrderStatusNotification } = require('../config/mailer');
            
            let emailSent = false;
            let emailType = '';
            
            switch(type) {
                case 'confirmed':
                    // Email de confirmation de commande
                    await sendOrderStatusNotification(orderData, 'pending', 'confirmed');
                    emailType = 'confirmation';
                    emailSent = true;
                    break;
                    
                case 'pending':
                    // Email de commande en attente  
                    await sendOrderStatusNotification(orderData, null, 'pending');
                    emailType = 'attente';
                    emailSent = true;
                    break;
                    
                case 'cancelled':
                    // Email d'annulation de commande
                    await sendOrderStatusNotification(orderData, 'pending', 'cancelled');
                    emailType = 'annulation';
                    emailSent = true;
                    break;
                    
                default:
                    throw new Error(`Type d'email non supporté: ${type}`);
            }
            
            if (emailSent) {
                console.log(`✅ Email de ${emailType} envoyé avec succès pour la commande ${order_number}`);
                
                res.json({
                    success: true,
                    message: `Email de ${emailType} envoyé avec succès`,
                    order_number,
                    customer_email,
                    type
                });
            } else {
                throw new Error('Erreur lors de l\'envoi de l\'email');
            }
            
        } catch (error) {
            console.error(`❌ Erreur lors de l'envoi de l'email ${type}:`, error);
            next(new AppError(`Erreur lors de l'envoi de l'email de ${type}`, 500));
        }
    });

module.exports = router;

