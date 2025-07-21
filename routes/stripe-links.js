const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');
const authMiddleware = require('../middleware/auth');

/**
 * Endpoint pour créer un lien de paiement dynamiquement
 * Prend un productId et génère un Payment Link Stripe
 */
router.post('/create-payment-link', async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    if (!productId) {
      return res.status(400).json({ error: 'productId est requis' });
    }

    // Récupérer le produit depuis la base de données
    let product;
    let stripeProductId;
    let stripePriceId;

    // Déterminer si c'est un produit normal ou un corner_product
    const normalProduct = await db.pool.query(
      'SELECT id, name, stripe_product_id, stripe_price_id FROM products WHERE id = ? AND active = 1',
      [productId]
    );

    const cornerProduct = await db.pool.query(
      'SELECT id, name, stripe_product_id, stripe_price_id FROM corner_products WHERE id = ? AND active = 1',
      [productId]
    );

    if (normalProduct.length > 0) {
      product = normalProduct[0];
      stripeProductId = product.stripe_product_id;
      stripePriceId = product.stripe_price_id;
    } else if (cornerProduct.length > 0) {
      product = cornerProduct[0];
      stripeProductId = product.stripe_product_id;
      stripePriceId = product.stripe_price_id;
    } else {
      return res.status(404).json({ error: 'Produit non trouvé ou inactif' });
    }

    if (!stripePriceId) {
      return res.status(400).json({ error: 'Produit sans prix Stripe associé' });
    }

    // Créer le lien de paiement
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: stripePriceId,
          quantity: quantity,
        },
      ],
      after_completion: {
        type: 'redirect',
        redirect: {
          url: `${process.env.FRONTEND_URL}/confirmation?product=${productId}`,
        },
      },
      // Ajout de métadonnées pour le suivi
      metadata: {
        product_id: productId,
        source: 'reboul_ecommerce',
        created_at: new Date().toISOString(),
      },
    });

    // Logger la création du lien
    console.log(`Payment Link créé pour le produit ${productId}: ${paymentLink.url}`);

    // Renvoyer l'URL du lien de paiement
    res.json({ 
      url: paymentLink.url,
      id: paymentLink.id
    });
    
  } catch (error) {
    console.error('Erreur création payment link:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Récupérer tous les liens de paiement actifs
 */
router.get('/payment-links', async (req, res) => {
  try {
    const paymentLinks = await stripe.paymentLinks.list({
      active: true,
      limit: 100,
    });
    
    res.json(paymentLinks.data);
  } catch (error) {
    console.error('Erreur récupération des payment links:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Récupérer le PaymentIntent depuis une session Stripe
 */
router.post('/get-payment-intent', async (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'session_id est requis' 
      });
    }

    console.log(`🔍 Récupération du PaymentIntent pour la session: ${session_id}`);

    // Récupérer la session Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['payment_intent']
    });

    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session Stripe non trouvée' 
      });
    }

    // Vérifier que la session a un payment_intent
    if (!session.payment_intent) {
      return res.status(400).json({ 
        success: false, 
        error: 'Aucun PaymentIntent associé à cette session' 
      });
    }

    console.log(`✅ PaymentIntent trouvé: ${session.payment_intent.id}`);

    // Retourner le PaymentIntent au format attendu par AdminOrders
    res.json({
      success: true,
      payment_intent: {
        id: session.payment_intent.id,
        status: session.payment_intent.status,
        amount: session.payment_intent.amount,
        currency: session.payment_intent.currency,
        capture_method: session.payment_intent.capture_method,
        charges: session.payment_intent.charges
      },
      session: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur récupération PaymentIntent:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Capturer un paiement Stripe (admin seulement)
 */
router.post('/capture-payment', async (req, res) => {
  try {
    const { payment_intent_id } = req.body;
    
    if (!payment_intent_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'payment_intent_id est requis' 
      });
    }

    console.log(`💳 Capture du paiement: ${payment_intent_id}`);

    // Capturer le PaymentIntent
    const paymentIntent = await stripe.paymentIntents.capture(payment_intent_id);

    if (!paymentIntent) {
      return res.status(404).json({ 
        success: false, 
        error: 'PaymentIntent non trouvé' 
      });
    }

    console.log(`✅ Paiement capturé avec succès: ${paymentIntent.id}, statut: ${paymentIntent.status}`);

    res.json({
      success: true,
      payment_intent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount_received: paymentIntent.amount_received,
        charges: paymentIntent.charges
      },
      message: 'Paiement capturé avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur capture paiement:', error);
    
    // Gérer les erreurs spécifiques Stripe
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * Annuler un paiement Stripe (admin seulement)
 */
router.post('/cancel-payment', async (req, res) => {
  try {
    const { payment_intent_id } = req.body;
    
    if (!payment_intent_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'payment_intent_id est requis' 
      });
    }

    console.log(`❌ Annulation du paiement: ${payment_intent_id}`);

    // Annuler le PaymentIntent
    const paymentIntent = await stripe.paymentIntents.cancel(payment_intent_id);

    if (!paymentIntent) {
      return res.status(404).json({ 
        success: false, 
        error: 'PaymentIntent non trouvé' 
      });
    }

    console.log(`✅ Paiement annulé avec succès: ${paymentIntent.id}, statut: ${paymentIntent.status}`);

    res.json({
      success: true,
      payment_intent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        cancellation_reason: paymentIntent.cancellation_reason
      },
      message: 'Paiement annulé avec succès'
    });
    
  } catch (error) {
    console.error('❌ Erreur annulation paiement:', error);
    
    // Gérer les erreurs spécifiques Stripe
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router; 