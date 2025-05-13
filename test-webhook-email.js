const nodemailer = require('nodemailer');
require('dotenv').config();

// Importer les fonctions de traitement des webhooks
// Vous pouvez copier les fonctions nécessaires du fichier stripewebhooks.js
const { sendStripePaymentConfirmation } = require('./config/mailer');
const pool = require('./db');

console.log('Test de traitement d\'événement webhook Stripe et envoi d\'email');
console.log('----------------------------------------');

// Événement webhook de test (format JSON)
const webhookEvent = {
  "id":"evt_1ROFBmCvFAONCF3NOjWVvJhe",
  "object":"event",
  "api_version":"2024-12-18.acacia",
  "created":1747128714,
  "data":{
    "object":{
      "id":"cs_test_b17GN5dyKb9Wo9RKORCHtAn6cAsAps4U7nSbKXIQq1RyHlZxJEjkjGjVFw",
      "object":"checkout.session",
      "amount_subtotal":12000,
      "amount_total":12590,
      "currency":"eur",
      "customer_details":{
        "address":{
          "city":"Marseille",
          "country":"FR",
          "line1":"Rue edouard alexander",
          "postal_code":"13010"
        },
        "email":"zxransounds@gmail.com", // Remplacez par une adresse email valide pour les tests
        "name":"Yoann Marrale",
        "phone":"+33767700099"
      },
      "metadata":{
        "discount_code":"",
        "shipping_method":"standard",
        "cartId":"cart-1747128679320",
        "items":"[{\"id\":\"36-EU 38-WHBLK\",\"quantity\":1,\"variant\":\"{\\\"size\\\":\\\"EU 38\\\",\\\"color\\\":\\\"WHBLK\\\",\\\"colorLabel\\\":\\\"WHBLK\\\",\\\"stock\\\":1}\"}]",
        "order_number": "TEST" + Math.floor(Math.random() * 10000) // Ajout d'un order_number pour le test
      },
      "mode":"payment",
      "payment_intent":"pi_3ROFBlCvFAONCF3N0YQ4afsf",
      "payment_status":"paid",
      "shipping_details":{
        "address":{
          "city":"Marseille",
          "country":"FR",
          "line1":"Rue edouard alexander",
          "postal_code":"13010"
        },
        "name":"Yoann Marrale"
      },
      "status":"complete",
      "total_details":{
        "amount_discount":0,
        "amount_shipping":590,
        "amount_tax":2000
      }
    }
  },
  "type":"checkout.session.completed"
};

// Préparer les données pour l'envoi de l'email
const session = webhookEvent.data.object;
const orderNumber = session.metadata.order_number;

console.log('Session ID:', session.id);
console.log('Order Number:', orderNumber);
console.log('Email client:', session.customer_details.email);
console.log('Montant total:', session.amount_total / 100, session.currency);

// Créer les données de paiement pour l'email
const paymentData = {
  sessionId: session.id,
  amount: session.amount_total / 100,
  currency: session.currency,
  customerEmail: session.customer_details.email,
  paymentStatus: session.payment_status,
  paymentMethod: 'card',
  paidAt: new Date().toISOString()
};

// Créer des données de commande simulées
const orderData = {
  order_number: orderNumber,
  shipping_info: {
    firstName: session.customer_details.name.split(' ')[0],
    lastName: session.customer_details.name.split(' ')[1] || '',
    email: session.customer_details.email,
    address: session.shipping_details.address.line1,
    city: session.shipping_details.address.city,
    postalCode: session.shipping_details.address.postal_code,
    country: session.shipping_details.address.country
  },
  items: JSON.parse(session.metadata.items || '[]')
};

console.log('Envoi de l\'email de confirmation...');

// Tester l'envoi d'email directement
sendStripePaymentConfirmation(paymentData, orderData)
  .then(info => {
    console.log('----------------------------------------');
    console.log('Email envoyé avec succès! ✅');
    console.log('Message ID:', info.messageId);
    console.log('Envoyé à:', orderData.shipping_info.email);
    console.log('----------------------------------------');
  })
  .catch(error => {
    console.error('----------------------------------------');
    console.error('Erreur lors de l\'envoi de l\'email: ❌');
    console.error('Type d\'erreur:', error.name);
    console.error('Message d\'erreur:', error.message);
    console.error('Code d\'erreur:', error.code);
    if (error.response) console.error('Réponse du serveur:', error.response);
    console.error('----------------------------------------');
  });

// NOTE: Pour un test complet, vous devriez également simuler 
// la mise à jour de la base de données, mais cela nécessiterait une base
// de test ou des mocks pour éviter d'impacter les données réelles. 