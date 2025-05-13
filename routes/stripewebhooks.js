const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const bodyParser = require('body-parser');
const pool = require('../db');
const nodemailer = require('nodemailer');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***' : 'MISSING');

// ID Stripe du shipping_rate pour le service coursier (à adapter si besoin)
const COURIER_SHIPPING_RATE_ID = 'shr_1RNwrWCvFAONCF3NWgfySCns';

// Configuration du transporteur email
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Fonction utilitaire pour envoyer un email avec Nodemailer
async function sendEmail({ to, subject, text }) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Reboul Store" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}

/**
 * Envoie un email de confirmation après un paiement réussi via Stripe
 * @param {Object} paymentData - Données du paiement Stripe
 * @param {Object} orderData - Données de la commande
 * @returns {Promise<Object>} - Résultat de l'envoi de l'email
 */
async function sendStripePaymentConfirmation(paymentData, orderData) {
  try {
    console.log('Envoi de confirmation de paiement Stripe pour la commande:', orderData.order_number);

    if (!orderData.shipping_info || !orderData.shipping_info.email) {
      throw new Error('Email du destinataire manquant dans shipping_info');
    }

    // Date et heure formatées
    const now = new Date();
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit' };
    const formattedDate = now.toLocaleDateString('fr-FR', dateOptions);
    const formattedTime = now.toLocaleTimeString('fr-FR', timeOptions);

    // Formater le montant (s'assurer qu'il s'agit d'un nombre)
    const amount = (typeof paymentData.amount === 'number') 
      ? paymentData.amount.toFixed(2) 
      : Number(paymentData.amount).toFixed(2);

    const transporter = createTransporter();
    const mailOptions = {
      from: `"Reboul Store" <${process.env.SMTP_USER}>`,
      to: orderData.shipping_info.email,
      subject: `Confirmation de paiement pour votre commande #${orderData.order_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="https://reboulstore.com/images/logo_black.png" alt="Reboul Store Logo" style="max-width: 200px;">
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #4CAF50; text-align: center; margin-top: 0;">Paiement confirmé</h1>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Bonjour ${orderData.shipping_info.firstName},
            </p>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Nous vous confirmons que votre paiement pour la commande <strong>#${orderData.order_number}</strong> a été effectué avec succès le ${formattedDate} à ${formattedTime}.
            </p>
            
            <div style="background-color: #f5f5f5; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h2 style="margin-top: 0; color: #333; font-size: 18px;">Récapitulatif de votre paiement</h2>
              <p style="margin: 5px 0;"><strong>Montant:</strong> ${amount} €</p>
              <p style="margin: 5px 0;"><strong>Méthode de paiement:</strong> ${paymentData.paymentMethod || 'Carte bancaire'}</p>
              <p style="margin: 5px 0;"><strong>Numéro de transaction:</strong> ${paymentData.sessionId || paymentData.paymentIntentId}</p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Votre commande est maintenant en cours de préparation. Vous recevrez un email lorsqu'elle sera expédiée, avec les informations de suivi.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://reboulstore.com/mon-compte/commandes" style="display: inline-block; background-color: #4a4a4a; color: white; text-decoration: none; padding: 12px 25px; border-radius: 4px; font-weight: bold;">
                Suivre ma commande
              </a>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Si vous avez des questions concernant votre commande, n'hésitez pas à nous contacter.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6;">
              Merci de votre confiance !
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; margin-bottom: 0;">
              L'équipe Reboul Store
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
            <p>© 2023 Reboul Store. Tous droits réservés.</p>
            <p>
              <a href="https://reboulstore.com/confidentialite" style="color: #666; text-decoration: underline;">Politique de confidentialité</a> | 
              <a href="https://reboulstore.com/conditions" style="color: #666; text-decoration: underline;">Conditions d'utilisation</a>
            </p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de confirmation de paiement Stripe envoyé avec succès:', {
      messageId: info.messageId,
      to: orderData.shipping_info.email
    });
    return info;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email de confirmation de paiement Stripe:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
}

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

// Fonction pour récupérer les détails complets d'une commande
async function getOrderDetails(orderNumber) {
  try {
    const orderQuery = await pool.query(
      `SELECT * FROM orders WHERE order_number = $1`,
      [orderNumber]
    );
    
    if (orderQuery.rows.length === 0) {
      console.error(`Commande ${orderNumber} non trouvée dans la base de données`);
      return null;
    }
    
    return orderQuery.rows[0];
  } catch (error) {
    console.error(`Erreur lors de la récupération des détails de la commande ${orderNumber}:`, error);
    return null;
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
  
  // Préparer les données de paiement
  const paymentData = {
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency,
    paymentMethod: paymentIntent.payment_method_types[0],
    paidAt: new Date().toISOString()
  };
  
  // Mettre à jour le statut de la commande
  const updateResult = await updateOrderPaymentStatus(orderNumber, 'paid', paymentData);

  if (updateResult.success) {
    console.log(`Commande ${orderNumber} marquée comme payée avec succès`);
    
    // Récupérer les détails complets de la commande
    const orderDetails = await getOrderDetails(orderNumber);
    
    if (orderDetails) {
      try {
        // Envoyer l'email de confirmation de paiement
        await sendStripePaymentConfirmation(paymentData, orderDetails);
        console.log(`Email de confirmation de paiement envoyé pour la commande ${orderNumber}`);
      } catch (error) {
        console.error(`Erreur lors de l'envoi de l'email de confirmation pour la commande ${orderNumber}:`, error.message);
      }
    }
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
  
  // Préparer les données de paiement
  const paymentData = {
    sessionId: session.id,
    amount: session.amount_total / 100,
    currency: session.currency,
    customerEmail: session.customer_details?.email,
    paymentStatus: session.payment_status,
    paymentMethod: session.payment_method_types[0],
    paidAt: new Date().toISOString()
  };
  
  // Mettre à jour le statut de la commande
  const updateResult = await updateOrderPaymentStatus(orderNumber, 'paid', paymentData);

  if (updateResult.success) {
    console.log(`Commande ${orderNumber} marquée comme payée avec succès via Checkout`);
    
    // Récupérer les détails complets de la commande
    const orderDetails = await getOrderDetails(orderNumber);
    
    if (orderDetails) {
      try {
        // Envoyer l'email de confirmation de paiement
        await sendStripePaymentConfirmation(paymentData, orderDetails);
        console.log(`Email de confirmation de paiement envoyé pour la commande ${orderNumber}`);
      } catch (error) {
        console.error(`Erreur lors de l'envoi de l'email de confirmation pour la commande ${orderNumber}:`, error.message);
      }
    }
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