const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const pool = require('../db');
const { body, param, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const authMiddleware = require('../middleware/auth');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

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

/**
 * @route POST /api/checkout/create-session
 * @desc Crée une session Stripe Checkout pour rediriger l'utilisateur
 * @access Privé - Utilisateur authentifié
 */
router.post(
  '/create-session',
  authMiddleware,
  [
    body('items').isArray().withMessage('Les articles doivent être fournis dans un tableau'),
    body('items.*.id').isInt().withMessage('ID de produit invalide'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('La quantité doit être au moins 1'),
    body('items.*.variant').isObject().withMessage('Les informations de variant sont requises'),
    body('success_url').isURL().withMessage('URL de succès invalide'),
    body('cancel_url').isURL().withMessage('URL d\'annulation invalide')
  ],
  validate([
    body('items'),
    body('items.*.id'),
    body('items.*.quantity'),
    body('items.*.variant'),
    body('success_url'),
    body('cancel_url')
  ]),
  async (req, res, next) => {
    const { items, success_url, cancel_url, shipping_info } = req.body;
    let client;

    try {
      client = await pool.pool.connect();
      await client.query('BEGIN');

      // Vérifier les produits et calculer le montant
      const lineItems = [];
      let totalAmount = 0;
      let metadata = {};

      // Stocker les métadonnées importantes
      if (shipping_info) {
        metadata.shipping_address = JSON.stringify({
          name: `${shipping_info.firstName} ${shipping_info.lastName}`,
          address: shipping_info.address,
          city: shipping_info.city,
          postal_code: shipping_info.postalCode,
          country: shipping_info.country,
          email: shipping_info.email,
          phone: shipping_info.phone
        });
      }

      // Vérifier les produits et préparer les articles pour Stripe
      for (const item of items) {
        const { rows } = await client.query(
          'SELECT id, name, price, variants FROM products WHERE id = $1',
          [item.id]
        );

        if (rows.length === 0) {
          throw new AppError(`Produit non trouvé: ${item.id}`, 404);
        }

        const product = rows[0];
        
        // Trouver le variant correspondant
        const variant = product.variants.find(
          v => String(v.size) === String(item.variant.size) && 
               String(v.color).toLowerCase() === String(item.variant.color).toLowerCase()
        );

        if (!variant) {
          throw new AppError(
            `Variant non trouvé pour le produit ${item.id} (taille: ${item.variant.size}, couleur: ${item.variant.color})`,
            404
          );
        }
        
        // Vérifier le stock
        if (variant.stock < item.quantity) {
          throw new AppError(
            `Stock insuffisant pour le produit ${product.name} (${item.variant.color} - ${item.variant.size}). ` +
            `Stock disponible: ${variant.stock}, Quantité demandée: ${item.quantity}`,
            400
          );
        }

        // Ajouter l'article à la ligne
        lineItems.push({
          price_data: {
            currency: 'eur',
            product_data: {
              name: product.name,
              description: `${item.variant.color} - ${item.variant.size}`,
              images: [item.image] // Optionnel: URL de l'image
            },
            unit_amount: Math.round(product.price * 100) // Stripe utilise les centimes
          },
          quantity: item.quantity
        });

        totalAmount += product.price * item.quantity;
      }

      // Générer un numéro de commande unique
      const timestamp = Date.now();
      const orderNumber = `ORD-${timestamp}`;
      metadata.order_number = orderNumber;
      metadata.user_id = req.user.id;

      // Créer la commande dans notre base de données (statut: pending)
      const orderResult = await client.query(
        'INSERT INTO orders (user_id, total_amount, shipping_info, status, payment_status, order_number) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [req.user.id, totalAmount, shipping_info, 'pending', 'pending', orderNumber]
      );
      
      const orderId = orderResult.rows[0].id;

      // Créer les items de la commande
      for (const item of items) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, price, variant_info) VALUES ($1, $2, $3, (SELECT price FROM products WHERE id = $2), $4)',
          [orderId, item.id, item.quantity, JSON.stringify(item.variant)]
        );
      }

      // Créer la session Stripe Checkout
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${success_url}?order_id=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${cancel_url}?order_id=${orderId}`,
        client_reference_id: String(orderId),
        customer_email: shipping_info?.email, // Pré-remplit l'email si disponible
        shipping_address_collection: {
          allowed_countries: ['FR', 'BE', 'CH', 'LU', 'DE', 'IT', 'ES', 'GB'], // Pays autorisés
        },
        shipping_options: [
          {
            shipping_rate_data: {
              type: 'fixed_amount',
              fixed_amount: {
                amount: 0, // Gratuit ou autre montant (en centimes)
                currency: 'eur',
              },
              display_name: 'Livraison standard',
              delivery_estimate: {
                minimum: {
                  unit: 'business_day',
                  value: 5,
                },
                maximum: {
                  unit: 'business_day',
                  value: 7,
                },
              },
            },
          },
        ],
        metadata: metadata,
      });

      // Enregistrer l'ID de session Checkout dans notre base de données
      await client.query(
        'UPDATE orders SET stripe_session_id = $1 WHERE id = $2',
        [session.id, orderId]
      );

      await client.query('COMMIT');
      
      // Retourner l'URL de redirection vers Stripe Checkout
      res.json({
        session_id: session.id,
        url: session.url,
        order: {
          id: orderId,
          order_number: orderNumber,
          total: totalAmount
        }
      });
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      next(error);
    } finally {
      if (client) client.release();
    }
  }
);

/**
 * @route GET /api/checkout/session/:id
 * @desc Vérifie le statut d'une session de paiement
 * @access Privé - Utilisateur authentifié
 */
router.get(
  '/session/:id',
  authMiddleware,
  param('id').isString().withMessage('ID de session invalide'),
  validate([param('id')]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Vérifier si l'utilisateur est autorisé à accéder à cette commande
      const { rows } = await pool.query(
        'SELECT * FROM orders WHERE stripe_session_id = $1',
        [id]
      );

      if (rows.length === 0) {
        return next(new AppError('Session de paiement non trouvée', 404));
      }

      const order = rows[0];
      
      // Vérifier si l'utilisateur est propriétaire ou admin
      if (order.user_id !== req.user.id && !req.user.isAdmin) {
        return next(new AppError('Accès non autorisé', 403));
      }

      // Récupérer les détails de la session depuis Stripe
      const session = await stripe.checkout.sessions.retrieve(id);

      res.json({
        session: {
          id: session.id,
          status: session.status,
          payment_status: session.payment_status,
          amount_total: session.amount_total / 100,
          currency: session.currency
        },
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          payment_status: order.payment_status,
          total_amount: order.total_amount
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router; 