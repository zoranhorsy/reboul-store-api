const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const bodyParser = require('body-parser');
const pool = require('../db');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Fonction pour mettre à jour le statut de paiement d'une commande
async function updateOrderPaymentStatus(orderNumber, status, paymentData = {}) {
  const client = await pool.pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log(`Mise à jour du statut de paiement pour la commande ${orderNumber} à "${status}"`);
    
    // Mise à jour du statut de paiement de la commande
    const updateResult = await client.query(
      'UPDATE orders SET payment_status = $1, payment_data = $2, updated_at = CURRENT_TIMESTAMP WHERE order_number = $3 RETURNING *',
      [status, JSON.stringify(paymentData), orderNumber]
    );

    if (updateResult.rows.length === 0) {
      console.error(`Commande non trouvée: ${orderNumber}`);
      await client.query('ROLLBACK');
      return { success: false, message: 'Commande non trouvée' };
    }

    // Si le paiement est réussi, mettre à jour le statut global de la commande
    if (status === 'paid') {
      await client.query(
        'UPDATE orders SET status = $1 WHERE order_number = $2',
        ['processing', orderNumber]
      );
    } else if (status === 'failed') {
      await client.query(
        'UPDATE orders SET status = $1 WHERE order_number = $2',
        ['cancelled', orderNumber]
      );
    }

    await client.query('COMMIT');
    return { success: true, order: updateResult.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur lors de la mise à jour du statut de la commande:', error);
    return { success: false, message: error.message };
  } finally {
    client.release();
  }
}

// Fonction pour enregistrer l'événement Stripe dans la base de données
async function logStripeEvent(event) {
  try {
    await pool.query(
      'INSERT INTO stripe_events (event_id, event_type, event_data) VALUES ($1, $2, $3)',
      [event.id, event.type, JSON.stringify(event)]
    );
    console.log(`Événement Stripe ${event.id} de type ${event.type} enregistré`);
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'événement Stripe:', error);
  }
}

// Fonction pour traiter un paiement réussi
async function handleSuccessfulPayment(event) {
  const paymentIntent = event.data.object;
  console.log(`Paiement réussi: ${paymentIntent.id} pour ${paymentIntent.amount/100} ${paymentIntent.currency}`);
  
  // Extraire les métadonnées
  const orderNumber = paymentIntent.metadata.order_number;
  
  if (!orderNumber) {
    console.error('Aucun numéro de commande trouvé dans les métadonnées du paiement:', paymentIntent.id);
    return;
  }
  
  // Mettre à jour le statut de la commande
  const updateResult = await updateOrderPaymentStatus(orderNumber, 'paid', {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency,
    paymentMethod: paymentIntent.payment_method_types[0],
    paidAt: new Date().toISOString()
  });

  if (updateResult.success) {
    console.log(`Commande ${orderNumber} marquée comme payée avec succès`);
  } else {
    console.error(`Erreur lors de la mise à jour de la commande ${orderNumber}:`, updateResult.message);
  }
}

// Fonction pour traiter un paiement échoué
async function handleFailedPayment(event) {
  const paymentIntent = event.data.object;
  console.log(`Paiement échoué: ${paymentIntent.id}, raison: ${paymentIntent.last_payment_error?.message || 'Inconnue'}`);
  
  // Extraire les métadonnées
  const orderNumber = paymentIntent.metadata.order_number;
  
  if (!orderNumber) {
    console.error('Aucun numéro de commande trouvé dans les métadonnées du paiement:', paymentIntent.id);
    return;
  }
  
  // Mettre à jour le statut de la commande
  const updateResult = await updateOrderPaymentStatus(orderNumber, 'failed', {
    paymentIntentId: paymentIntent.id,
    error: paymentIntent.last_payment_error?.message || 'Paiement refusé',
    failedAt: new Date().toISOString()
  });

  if (updateResult.success) {
    console.log(`Commande ${orderNumber} marquée comme échouée`);
  } else {
    console.error(`Erreur lors de la mise à jour de la commande ${orderNumber}:`, updateResult.message);
  }
}

// Fonction pour traiter une session Checkout complétée
async function handleCheckoutCompleted(event) {
  const session = event.data.object;
  console.log(`Session Checkout complétée: ${session.id}`);
  
  // Extraire les métadonnées
  const orderNumber = session.metadata?.order_number;
  
  if (!orderNumber) {
    console.error('Aucun numéro de commande trouvé dans les métadonnées de la session:', session.id);
    return;
  }
  
  // Mettre à jour le statut de la commande
  const updateResult = await updateOrderPaymentStatus(orderNumber, 'paid', {
    sessionId: session.id,
    amount: session.amount_total / 100,
    currency: session.currency,
    customerEmail: session.customer_details?.email,
    paymentStatus: session.payment_status,
    paidAt: new Date().toISOString()
  });

  if (updateResult.success) {
    console.log(`Commande ${orderNumber} marquée comme payée avec succès via Checkout`);
  } else {
    console.error(`Erreur lors de la mise à jour de la commande ${orderNumber} via Checkout:`, updateResult.message);
  }
}

// Stripe a besoin du raw body pour vérifier la signature
router.post(
  '/stripe',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log(`Événement Stripe reçu: ${event.type} (${event.id})`);
    } catch (err) {
      console.error('⚠️  Webhook signature verification failed.', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Enregistrer l'événement dans la base de données (asynchrone)
    logStripeEvent(event).catch(err => console.error('Erreur lors de l\'enregistrement de l\'événement:', err));

    // Traiter l'événement
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event);
          break;
        case 'payment_intent.succeeded':
          await handleSuccessfulPayment(event);
          break;
        case 'payment_intent.payment_failed':
          await handleFailedPayment(event);
          break;
        default:
          console.log(`Événement non géré: ${event.type}`);
      }

      // Répondre rapidement au webhook
      res.status(200).json({ received: true });
    } catch (error) {
      console.error(`Erreur lors du traitement de l'événement ${event.type}:`, error);
      res.status(200).json({ received: true }); // Toujours répondre 200 pour éviter les réessais de Stripe
    }
  }
);

module.exports = router;