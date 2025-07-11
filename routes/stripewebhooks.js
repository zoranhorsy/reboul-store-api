const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const bodyParser = require('body-parser');
const pool = require('../db');
const nodemailer = require('nodemailer');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

console.log('Initialisation de la connexion à la base de données...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, process.env.DATABASE_URL.indexOf('@') + 1) + '****@****' : 'MISSING');
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
    } else if (status === 'authorized') {
      await client.query(
        'UPDATE orders SET status = $1 WHERE order_number = $2',
        ['pending', orderNumber]
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
  console.log(`Payment Intent réussi: ${paymentIntent.id}`);
  
  // Extraire les métadonnées
  const orderNumber = paymentIntent.metadata?.order_number;
  const userId = paymentIntent.metadata?.user_id ? parseInt(paymentIntent.metadata.user_id, 10) : null;
  
  if (orderNumber) {
    console.log(`Numéro de commande trouvé dans les métadonnées: ${orderNumber}`);
    
    try {
      // Rechercher si une commande existe avec ce numéro
      const orderQuery = await pool.query(
        'SELECT * FROM orders WHERE order_number = $1',
        [orderNumber]
      );
      
      if (orderQuery.rows.length > 0) {
        // Une commande existe déjà, on met simplement à jour son statut
        const orderDetails = orderQuery.rows[0];
        console.log(`Commande trouvée pour le payment_intent ${paymentIntent.id}: ${orderDetails.order_number}`);
        
        // Préparer les données de paiement
        const paymentData = {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency,
          paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
          paidAt: new Date().toISOString()
        };
        
        // Mettre à jour le statut
        const updateResult = await updateOrderPaymentStatus(orderDetails.order_number, 'paid', paymentData);
        
        // Si l'utilisateur est défini dans les métadonnées mais pas dans la commande, mettre à jour
        if (userId && !orderDetails.user_id) {
          try {
            await pool.query(
              'UPDATE orders SET user_id = $1 WHERE order_number = $2',
              [userId, orderDetails.order_number]
            );
            console.log(`ID utilisateur ${userId} ajouté à la commande ${orderDetails.order_number}`);
          } catch (userIdError) {
            console.error(`Erreur lors de la mise à jour de l'ID utilisateur pour ${orderDetails.order_number}:`, userIdError.message);
          }
        }
        
        if (updateResult.success) {
          try {
            // Envoyer l'email de confirmation
            await sendStripePaymentConfirmation(paymentData, orderDetails);
            console.log(`Email de confirmation envoyé pour la commande ${orderDetails.order_number}`);
          } catch (emailError) {
            console.error(`Erreur lors de l'envoi de l'email pour ${orderDetails.order_number}:`, emailError.message);
          }
        }
        
        return;
      }
      
      // Si on arrive ici, on n'a pas trouvé de commande existante
      // Créons une nouvelle commande
      console.log('Création d\'une commande à partir des données du payment_intent');
      
      // Essayer de récupérer l'email du client depuis les données disponibles
      let customerEmail = null;
      
      // Vérifier si receipt_email est disponible
      if (paymentIntent.receipt_email) {
        customerEmail = paymentIntent.receipt_email;
        console.log(`Email trouvé via receipt_email: ${customerEmail}`);
      } 
      // Récupérer l'email depuis les charges associées
      else if (paymentIntent.latest_charge) {
        try {
          const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
          if (charge.receipt_email) {
            customerEmail = charge.receipt_email;
            console.log(`Email trouvé via charge: ${customerEmail}`);
          } else if (charge.billing_details?.email) {
            customerEmail = charge.billing_details.email;
            console.log(`Email trouvé via billing_details: ${customerEmail}`);
          }
        } catch (err) {
          console.error('Erreur lors de la récupération de la charge:', err);
        }
      }
      
      // Générer un numéro de commande unique si aucun n'est fourni
      const newOrderNumber = orderNumber || `ORD-${Date.now()}`;
      const client = await pool.pool.connect();
      try {
        await client.query('BEGIN');
        
        // Créer la commande
        const orderResult = await client.query(
          `INSERT INTO orders 
          (user_id, total_amount, shipping_info, status, payment_status, order_number, payment_data) 
          VALUES ($1, $2, $3, $4, $5, $6, $7) 
          RETURNING *`,
          [
            userId, // Utiliser l'ID utilisateur des métadonnées
            paymentIntent.amount / 100,
            {
              email: customerEmail
            },
            'processing',
            'paid',
            newOrderNumber,
            {
              paymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount / 100,
              currency: paymentIntent.currency,
              paidAt: new Date().toISOString()
            }
          ]
        );
        
        const newOrder = orderResult.rows[0];
        
        await client.query('COMMIT');
        
        // Envoyer un email de confirmation si possible
        if (customerEmail) {
          const paymentData = {
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            customerEmail: customerEmail,
            paymentStatus: 'paid',
            paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
            paidAt: new Date().toISOString()
          };
          
          try {
            await sendStripePaymentConfirmation(paymentData, newOrder);
            console.log(`Email de confirmation envoyé pour la nouvelle commande ${newOrderNumber}`);
          } catch (emailError) {
            console.error(`Erreur lors de l'envoi de l'email pour ${newOrderNumber}:`, emailError.message);
          }
        } else {
          console.log(`Pas d'email disponible pour envoyer une confirmation pour ${newOrderNumber}`);
        }
        
      } catch (dbError) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la création de la commande:', dbError);
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('Erreur lors de la recherche/création de commande pour payment_intent:', error);
    }
    
    return;
  }
  
  // Si on arrive ici, il n'y a pas de numéro de commande dans les métadonnées
  console.log('Aucun numéro de commande trouvé dans les métadonnées du payment_intent:', paymentIntent.id);
  
  try {
    // Essayer de trouver une commande associée à ce payment_intent
    const existingOrderQuery = await pool.query(
      `SELECT * FROM orders WHERE payment_data->>'paymentIntentId' = $1`,
      [paymentIntent.id]
    );
    
    if (existingOrderQuery.rows.length > 0) {
      const existingOrder = existingOrderQuery.rows[0];
      console.log(`Commande existante trouvée via payment_data: ${existingOrder.order_number}`);
      
      // Préparer les données de paiement
      const paymentData = {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
        paidAt: new Date().toISOString()
      };
      
      // Mettre à jour le statut de la commande
      const updateResult = await updateOrderPaymentStatus(existingOrder.order_number, 'paid', paymentData);
      
      // Si l'utilisateur est défini dans les métadonnées mais pas dans la commande, mettre à jour
      if (userId && !existingOrder.user_id) {
        try {
          await pool.query(
            'UPDATE orders SET user_id = $1 WHERE order_number = $2',
            [userId, existingOrder.order_number]
          );
          console.log(`ID utilisateur ${userId} ajouté à la commande existante ${existingOrder.order_number}`);
        } catch (userIdError) {
          console.error(`Erreur lors de la mise à jour de l'ID utilisateur pour ${existingOrder.order_number}:`, userIdError.message);
        }
      }
      
      if (updateResult.success) {
        try {
          // Envoyer l'email de confirmation
          await sendStripePaymentConfirmation(paymentData, existingOrder);
          console.log(`Email de confirmation envoyé pour la commande ${existingOrder.order_number}`);
        } catch (emailError) {
          console.error(`Erreur lors de l'envoi de l'email pour ${existingOrder.order_number}:`, emailError.message);
        }
      }
      
      return;
    }
  } catch (queryError) {
    console.error('Erreur lors de la recherche de commandes existantes:', queryError);
  }
  
  // Si on arrive ici, on n'a pas pu trouver ou créer une commande
  console.log('Impossible de traiter ce payment_intent car aucun numéro de commande ou commande existante n\'a été trouvé');
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
  console.log(`============ DÉBUT TRAITEMENT CHECKOUT COMPLETED ============`);
  console.log(`Session Checkout complétée: ${session.id}`);
  console.log(`Session complète: ${JSON.stringify(session, null, 2)}`);

  // Extraire les métadonnées
  const orderNumber = session.metadata?.order_number;
  const userId = session.metadata?.user_id ? parseInt(session.metadata.user_id, 10) : null;
  
  // Priorité à l'email du compte authentifié pour garantir l'association
  const accountEmail = session.metadata?.account_email;
  const customerProvidedEmail = session.customer_details?.email || session.customer_email;
  let userEmail;
  
  if (accountEmail && accountEmail !== 'null' && accountEmail !== '') {
    userEmail = accountEmail;  // Utiliser l'email du compte si disponible
    console.log(`[DEBUG WEBHOOK] Utilisation de l'email du compte authentifié: ${accountEmail}`);
  } else {
    userEmail = customerProvidedEmail;
    console.log(`[DEBUG WEBHOOK] Aucun email de compte, utilisation de l'email client: ${customerProvidedEmail}`);
  }
  
  const isAuthenticatedUser = session.metadata?.is_authenticated_user === "true";
  const userName = session.metadata?.user_name || session.customer_details?.name;
  const shippingMethod = session.metadata?.shipping_method;
  
  console.log(`[DEBUG WEBHOOK] Informations de commande DÉTAILLÉES:`, {
    orderNumber,
    userId,
    accountEmail,
    customerProvidedEmail,
    finalEmail: userEmail,
    isAuthenticatedUser,
    sessionId: session.id,
    totalAmount: session.amount_total / 100,
    paymentStatus: session.payment_status,
    shippingMethod
  });
  
  if (!orderNumber) {
    console.error('❌ ERREUR CRITIQUE: Aucun numéro de commande trouvé dans les métadonnées de la session:', session.id);
    return;
  }
  
  console.log(`Traitement de la commande ${orderNumber} - Utilisateur connecté: ${isAuthenticatedUser ? 'OUI' : 'NON'}`);
  if (isAuthenticatedUser) {
    console.log(`Email du compte: ${accountEmail}, Email saisi dans Stripe: ${userEmail}`);
  }
  
  // Récupérer l'ID client Stripe s'il existe
  const stripeCustomerId = session.customer;
  console.log(`ID Client Stripe: ${stripeCustomerId || 'Non trouvé'}`);
  
  // Récupérer les informations d'expédition
  const shippingDetails = session.shipping_details || {};
  const shippingAddress = shippingDetails.address || {};
  
  // Déterminer le type de livraison à partir des métadonnées ou des options de livraison sélectionnées
  let deliveryType = shippingMethod;
  try {
    if (session.shipping_rate) {
      // Si le taux d'expédition est disponible, utiliser son nom d'affichage
      if (session.shipping_rate.display_name) {
        deliveryType = session.shipping_rate.display_name;
      }
    }
  } catch (e) {
    console.log("Impossible de déterminer le type de livraison à partir de shipping_rate:", e.message);
  }
  
  console.log(`Type de livraison détecté: ${deliveryType}`);
  
  // Préparer les données d'adresse de livraison
  const hasAddress = 
    shippingAddress.line1 !== undefined && 
    shippingAddress.city !== undefined && 
    shippingAddress.postal_code !== undefined;
    
  console.log(`Adresse trouvée: ${hasAddress ? 'OUI' : 'NON'}`);
  if (hasAddress) {
    console.log(`Adresse: ${shippingAddress.line1}, ${shippingAddress.city}, ${shippingAddress.postal_code}`);
  }
  
  // Rechercher l'utilisateur par email si pas d'ID utilisateur dans les métadonnées
  let updatedUserId = userId;
  if (!updatedUserId) {
    // Essayer d'abord avec l'email du compte authentifié s'il existe
    if (accountEmail) {
      try {
        const userQuery = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [accountEmail]
        );
        
        if (userQuery.rows.length > 0) {
          updatedUserId = userQuery.rows[0].id;
          console.log(`Utilisateur trouvé par email du compte authentifié: ${accountEmail}, ID: ${updatedUserId}`);
        }
      } catch (emailLookupError) {
        console.error(`Erreur lors de la recherche d'utilisateur par email du compte:`, emailLookupError);
      }
    }
    
    // Si toujours pas d'utilisateur trouvé, essayer avec l'email saisi dans Stripe
    if (!updatedUserId && userEmail) {
      try {
        const userQuery = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [userEmail]
        );
        
        if (userQuery.rows.length > 0) {
          updatedUserId = userQuery.rows[0].id;
          console.log(`Utilisateur trouvé par email Stripe: ${userEmail}, ID: ${updatedUserId}`);
        }
      } catch (emailLookupError) {
        console.error(`Erreur lors de la recherche d'utilisateur par email Stripe:`, emailLookupError);
      }
    }
  }
  
  // Préparer les données du client Stripe à stocker
  const customerInfo = {
    email: userEmail || session.customer_details?.email,
    name: userName || session.customer_details?.name,
    phone: session.customer_details?.phone,
    address: shippingAddress,
    created: new Date().toISOString(),
    deliveryType: deliveryType,
    accountEmail: accountEmail, // Ajouter l'email du compte pour référence future
    isAuthenticatedUser: isAuthenticatedUser,
    stripe_email: session.customer_details?.email || session.customer_email, // Toujours stocker l'email utilisé dans Stripe
    reboul_email: accountEmail || userEmail // Email associé au compte Reboul
  };
  
  console.log(`[DEBUG WEBHOOK] customer_info à stocker:`, JSON.stringify(customerInfo, null, 2));
  
  // Créons une nouvelle commande
  console.log(`⚠️ ATTENTION: La commande ${orderNumber} n'existe pas encore, création à partir de la session`);
  
  // Extraire et traiter le nom complet
  const fullName = userName || session.customer_details?.name || '';
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  
  console.log(`Informations client extraites: ${firstName} ${lastName}, Email: ${userEmail}`);
  
  // Préparer les données de paiement avant de les utiliser
  const paymentData = {
    sessionId: session.id,
    paymentIntentId: session.payment_intent,
    amount: session.amount_total / 100,
    currency: session.currency,
    customerEmail: userEmail || session.customer_details?.email,
    customerName: userName || session.customer_details?.name,
    paymentStatus: session.payment_status,
    paymentMethod: session.payment_method_types?.[0] || 'card',
    deliveryType: deliveryType,
    paidAt: new Date().toISOString()
  };
  
  // Créer la commande
  const client = await pool.pool.connect();
  try {
    console.log(`🔄 TENTATIVE DE CRÉATION DE COMMANDE DANS LA BASE DE DONNÉES ===================`);
    console.log(`Données utilisées pour la requête SQL:`);
    console.log(`- user_id: ${userId}`);
    console.log(`- total_amount: ${session.amount_total / 100}`);
    console.log(`- status: processing`);
    console.log(`- payment_status: paid`);
    console.log(`- order_number: ${orderNumber}`);
    console.log(`- stripe_session_id: ${session.id}`);
    console.log(`- stripe_customer_id: ${stripeCustomerId}`);
    
    await client.query('BEGIN');
    
    console.log(`Exécution de la requête d'insertion...`);
    const orderResult = await client.query(
      `INSERT INTO orders 
      (user_id, total_amount, shipping_info, status, payment_status, order_number, payment_data, stripe_session_id, stripe_customer_id, customer_info) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *`,
      [
        userId,
        session.amount_total / 100,
        {
          firstName: firstName,
          lastName: lastName,
          email: userEmail || session.customer_details?.email,
          phone: session.customer_details?.phone,
          address: shippingAddress.line1,
          addressLine2: shippingAddress.line2,
          city: shippingAddress.city,
          postalCode: shippingAddress.postal_code,
          country: shippingAddress.country,
          hasAddress: hasAddress,
          addressType: 'shipping',
          isValid: hasAddress,
          deliveryType: deliveryType
        },
        'pending',
        'authorized',
        orderNumber,
        paymentData, 
        session.id,
        stripeCustomerId,
        customerInfo
      ]
    );
    
    const newOrder = orderResult.rows[0];
    console.log(`✅ COMMANDE CRÉÉE AVEC SUCCÈS: ID = ${newOrder.id}, Numéro = ${orderNumber}`);
    
    // Si des informations d'articles sont disponibles dans les métadonnées, les ajouter
    if (session.metadata?.items) {
      try {
        console.log(`Traitement des articles de la commande depuis metadata.items:`);
        console.log(`Contenu brut de metadata.items: ${session.metadata.items}`);
        
        const itemsData = JSON.parse(session.metadata.items);
        console.log(`Nombre d'articles à traiter: ${itemsData.length}`);
        
        for (const item of itemsData) {
          try {
            console.log('Traitement de l\'item:', JSON.stringify(item));
            
            // Extraire correctement l'ID numérique du produit
            let productId;
            if (typeof item.id === 'string' && item.id.includes('-')) {
              // Format: "72-EU 42-Argent" -> extraire juste "72"
              productId = parseInt(item.id.split('-')[0], 10);
              console.log(`ID produit extrait: ${productId} depuis ${item.id}`);
            } else {
              productId = parseInt(item.id, 10);
            }
            
            if (isNaN(productId)) {
              console.error(`❌ ID de produit invalide: ${item.id}, impossible de l'ajouter à la commande`);
              continue;
            }

            // Parser le variant
            let variantInfo = {};
            if (item.variant) {
              if (typeof item.variant === 'string') {
                try {
                  console.log(`Parsing du variant (string): ${item.variant}`);
                  variantInfo = JSON.parse(item.variant);
                  console.log(`Variant parsé avec succès:`, variantInfo);
                } catch (e) {
                  console.error(`❌ Erreur lors du parsing du variant (string):`, e);
                }
              } else if (typeof item.variant === 'object') {
                variantInfo = item.variant;
                console.log(`Variant déjà sous forme d'objet:`, variantInfo);
              }
            }
            
            // Récupérer les informations du produit (notamment le nom)
            console.log(`Recherche du produit ${productId} dans la base de données...`);
            const productResult = await client.query(
              'SELECT name, price FROM products WHERE id = $1',
              [productId]
            );
            
            if (productResult.rows.length === 0) {
              console.error(`❌ Produit non trouvé dans la base de données: ${productId}`);
              continue;
            }
            
            const product = productResult.rows[0];
            console.log(`✅ Produit trouvé: ${product.name} (${productId}), prix: ${product.price}`);
            
            console.log(`Insertion produit dans order_items: ID=${productId}, Nom=${product.name}, Quantité=${item.quantity}, Variant=`, variantInfo);
            
            const orderItemResult = await client.query(
              `INSERT INTO order_items 
              (order_id, product_id, product_name, quantity, price, variant_info) 
              VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [newOrder.id, productId, product.name, item.quantity, product.price, variantInfo]
            );
            
            console.log(`✅ Article ajouté à la commande, ID: ${orderItemResult.rows[0].id}`);
            
          } catch (itemError) {
            console.error(`❌ ERREUR lors du traitement de l'item ${JSON.stringify(item)}:`, itemError);
          }
        }
      } catch (e) {
        console.error('❌ ERREUR CRITIQUE lors de l\'ajout des items:', e);
        console.error('Contenu brut de metadata.items qui a causé l\'erreur:', session.metadata.items);
      }
    } else {
      console.warn('⚠️ Aucun article trouvé dans les métadonnées de la session.');
    }
    
    console.log('COMMIT de la transaction...');
    await client.query('COMMIT');
    console.log('✅ COMMIT RÉUSSI: La commande et ses articles sont enregistrés dans la base de données');
    
    // Envoyer l'email de confirmation - Pas besoin de redéfinir paymentData ici car déjà défini plus haut
    try {
      console.log(`Envoi de l'email de confirmation pour la commande ${orderNumber}...`);
      await sendStripePaymentConfirmation(paymentData, newOrder);
      console.log(`✅ Email de confirmation envoyé pour la commande nouvellement créée ${orderNumber}`);
      console.log(`============ FIN TRAITEMENT CHECKOUT COMPLETED AVEC SUCCÈS ============`);
      return;
    } catch (emailError) {
      console.error(`❌ Erreur lors de l'envoi de l'email pour ${orderNumber}:`, emailError.message);
    }
    
  } catch (dbError) {
    await client.query('ROLLBACK');
    console.error('❌❌❌ ERREUR CRITIQUE: Échec création commande:', dbError);
    console.error('Stack trace:', dbError.stack);
    
    // Log détaillé de l'erreur pour mieux comprendre
    if (dbError.code) {
      console.error(`Code erreur SQL: ${dbError.code}, Détail: ${dbError.detail}, Table: ${dbError.table}, Contrainte: ${dbError.constraint}`);
    }
    
    // Tentative de sauvegarde d'urgence dans un fichier
    try {
      const fs = require('fs');
      const path = require('path');
      const emergencyLogFile = path.join(__dirname, '../logs/failed_orders.json');
      
      // Créer le dossier logs s'il n'existe pas
      if (!fs.existsSync(path.join(__dirname, '../logs'))) {
        fs.mkdirSync(path.join(__dirname, '../logs'), { recursive: true });
      }
      
      const orderData = {
        timestamp: new Date().toISOString(),
        session_id: session.id,
        order_number: orderNumber,
        user_email: userEmail || session.customer_details?.email,
        amount: session.amount_total / 100,
        error: dbError.message,
        metadata: session.metadata
      };
      
      // Écrire dans le fichier
      fs.appendFileSync(emergencyLogFile, JSON.stringify(orderData) + '\n');
      console.log('✅ Sauvegarde d\'urgence réussie pour la commande dans:', emergencyLogFile);
    } catch (e) {
      console.error('❌ Échec de la sauvegarde d\'urgence:', e);
    }
  } finally {
    client.release();
    console.log(`============ FIN TRAITEMENT CHECKOUT COMPLETED ============`);
  }
}

// Stripe a besoin du raw body pour vérifier la signature
router.post(
  '/stripe',
  bodyParser.raw({ type: 'application/json' }),
  async (req, res) => {
    console.log(`========== WEBHOOK STRIPE REÇU ==========`);
    console.log(`Headers:`, req.headers);
    
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    console.log(`Signature reçue: ${sig ? 'OUI' : 'NON'}`);
    console.log(`Secret configuré: ${endpointSecret ? 'OUI' : 'NON'}`);
    
    if (!sig) {
      console.error('❌ Pas de signature Stripe dans les headers');
      return res.status(400).send(`Webhook Error: Pas de signature Stripe`);
    }
    
    if (!endpointSecret) {
      console.error('❌ Pas de STRIPE_WEBHOOK_SECRET configuré');
      return res.status(500).send(`Webhook Error: Pas de webhook secret configuré`);
    }

    let event;

    try {
      console.log(`Vérification de la signature avec constructEvent...`);
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      console.log(`✅ Événement Stripe reçu et vérifié: ${event.type} (${event.id})`);
    } catch (err) {
      console.error('❌ Webhook signature verification failed.', err.message);
      console.error('Details:', {
        message: err.message,
        type: err.type,
        signature: sig.substring(0, 20) + '...'
      });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Enregistrer l'événement dans la base de données (asynchrone)
    console.log(`Enregistrement de l'événement dans la base de données...`);
    logStripeEvent(event).catch(err => console.error('❌ Erreur lors de l\'enregistrement de l\'événement:', err));

    // Traiter l'événement
    try {
      console.log(`Traitement de l'événement ${event.type}...`);
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
          console.log(`⚠️ Événement non géré: ${event.type}`);
      }

      // Répondre rapidement au webhook
      console.log(`✅ Traitement terminé, réponse au webhook avec code 200`);
      res.status(200).json({ received: true });
    } catch (error) {
      console.error(`❌ ERREUR CRITIQUE lors du traitement de l'événement ${event.type}:`, error);
      console.error('Stack trace:', error.stack);
      res.status(200).json({ received: true }); // Toujours répondre 200 pour éviter les réessais de Stripe
    }
    console.log(`========== FIN WEBHOOK STRIPE ==========`);
  }
);

// Exposer les fonctions pour les tests
module.exports = router;

// Export spécial pour les tests
module.exports.handlers = {
  handleSuccessfulPayment,
  handleFailedPayment,
  handleCheckoutCompleted,
  updateOrderPaymentStatus,
  getOrderDetails
};