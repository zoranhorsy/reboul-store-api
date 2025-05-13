const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

console.log('SMTP_USER:', process.env.SMTP_USER);
console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***' : 'MISSING');

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

// MOCK: Fonction pour mettre à jour le statut de paiement d'une commande
async function updateOrderPaymentStatus(orderNumber, status, paymentData = {}) {
  console.log(`[MOCK] Mise à jour du statut de paiement pour la commande ${orderNumber} à "${status}"`);
  console.log(`[MOCK] Données de paiement:`, paymentData);
  
  // Simuler une réponse réussie
  return { 
    success: true, 
    order: {
      order_number: orderNumber,
      payment_status: status,
      payment_data: paymentData,
      shipping_info: {
        firstName: 'Client',
        lastName: 'Test',
        email: 'claude.tech.test@gmail.com',
        address: '123 Rue de Test',
        city: 'Paris',
        postalCode: '75001',
        country: 'France'
      }
    } 
  };
}

// MOCK: Fonction pour enregistrer l'événement Stripe dans la base de données
async function logStripeEvent(event) {
  console.log(`[MOCK] Événement Stripe ${event.id} de type ${event.type} enregistré`);
}

// MOCK: Fonction pour récupérer les détails complets d'une commande
async function getOrderDetails(orderNumber) {
  console.log(`[MOCK] Récupération des détails de la commande ${orderNumber}`);
  
  // Simuler une réponse avec des données de commande
  return {
    order_number: orderNumber,
    shipping_info: {
      firstName: 'Client',
      lastName: 'Test',
      email: 'claude.tech.test@gmail.com',
      address: '123 Rue de Test',
      city: 'Paris',
      postalCode: '75001',
      country: 'France'
    },
    status: 'processing',
    payment_status: 'pending',
    total_amount: 125.90
  };
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
    paymentMethod: session.payment_method_types?.[0] || 'card',
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
        // Utiliser les détails du client de la session Stripe plutôt que ceux de la base de données
        orderDetails.shipping_info = {
          ...orderDetails.shipping_info,
          firstName: session.customer_details?.name?.split(' ')[0] || orderDetails.shipping_info.firstName,
          lastName: session.customer_details?.name?.split(' ')[1] || orderDetails.shipping_info.lastName,
          email: session.customer_details?.email || orderDetails.shipping_info.email
        };
        
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

// Pas besoin de router pour les tests
module.exports = {
  handleCheckoutCompleted,
  handleSuccessfulPayment,
  handleFailedPayment,
  sendStripePaymentConfirmation
}; 