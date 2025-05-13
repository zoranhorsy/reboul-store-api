require('dotenv').config();
const nodemailer = require('nodemailer');
const { sendStripePaymentConfirmation } = require('./config/mailer');

console.log('Test d\'envoi d\'email de confirmation de paiement sans numéro de commande');
console.log('----------------------------------------');

// Simuler un objet payment data (comme ceux provenant d'un webhook Stripe)
const paymentData = {
  sessionId: 'cs_test_' + Math.random().toString(36).substring(2, 15),
  paymentIntentId: 'pi_' + Math.random().toString(36).substring(2, 15),
  amount: 125.90,
  currency: 'eur',
  customerEmail: 'zxransounds@gmail.com', // Remplacer par votre email pour les tests
  paymentStatus: 'paid',
  paymentMethod: 'card',
  paidAt: new Date().toISOString()
};

// Simuler une commande générée à partir des données de l'événement
const orderData = {
  order_number: 'ORD-' + Date.now(),
  shipping_info: {
    firstName: 'Client',
    lastName: 'Test',
    email: 'zxransounds@gmail.com', // Remplacer par votre email pour les tests
    address: '123 Rue de Test',
    city: 'Paris',
    postalCode: '75001',
    country: 'France'
  },
  status: 'processing',
  payment_status: 'paid',
  total_amount: 125.90
};

console.log('Données de paiement simulées:');
console.log('- Session ID:', paymentData.sessionId);
console.log('- Payment Intent ID:', paymentData.paymentIntentId);
console.log('- Montant:', paymentData.amount, paymentData.currency);
console.log('- Email client:', paymentData.customerEmail);

console.log('\nDonnées de commande simulées:');
console.log('- Numéro de commande:', orderData.order_number);
console.log('- Client:', `${orderData.shipping_info.firstName} ${orderData.shipping_info.lastName}`);
console.log('- Email:', orderData.shipping_info.email);
console.log('- Adresse:', orderData.shipping_info.address);

console.log('\nEnvoi de l\'email de confirmation...');

// Tester l'envoi d'email
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