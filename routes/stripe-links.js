const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');

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

module.exports = router; 