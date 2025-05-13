require('dotenv').config();
const { handleSuccessfulPayment, handleCheckoutCompleted } = require('./routes/stripewebhooks-test');
const fs = require('fs');
const path = require('path');

console.log('Test de gestion des événements multiples Stripe (payment_intent et checkout.session)');
console.log('----------------------------------------');

// Créer une copie du fichier stripewebhooks.js pour les tests
const stripeWebhooksPath = path.join(__dirname, 'routes', 'stripewebhooks.js');
const stripeWebhooksTestPath = path.join(__dirname, 'routes', 'stripewebhooks-test.js');

console.log('Création du fichier de test pour les gestionnaires de webhook...');

// Lire le fichier stripewebhooks.js
const stripeWebhooksContent = fs.readFileSync(stripeWebhooksPath, 'utf8');

// Modifier le contenu pour exporter les fonctions de traitement
const modifiedContent = stripeWebhooksContent + `\nmodule.exports = { handleCheckoutCompleted, handleSuccessfulPayment, handleFailedPayment };\n`;

// Écrire le contenu dans le fichier de test
fs.writeFileSync(stripeWebhooksTestPath, modifiedContent);

console.log('Fichier de test créé.');

// ID unique pour les tests
const uniqueId = Date.now();
const paymentIntentId = `pi_test_${uniqueId}`;
const sessionId = `cs_test_${uniqueId}`;
const orderNumber = `ORD-${uniqueId}`;

// Email pour le test
const testEmail = 'zxransounds@gmail.com';

// Événement payment_intent.succeeded de test
const paymentIntentEvent = {
  "id": `evt_pi_${uniqueId}`,
  "object": "event",
  "api_version": "2024-12-18.acacia",
  "created": uniqueId,
  "data": {
    "object": {
      "id": paymentIntentId,
      "object": "payment_intent",
      "amount": 12590,
      "amount_capturable": 0,
      "amount_details": { "tip": {} },
      "amount_received": 12590,
      "application": null,
      "application_fee_amount": null,
      "automatic_payment_methods": null,
      "canceled_at": null,
      "cancellation_reason": null,
      "capture_method": "automatic_async",
      "client_secret": `${paymentIntentId}_secret_xxx`,
      "confirmation_method": "automatic",
      "created": uniqueId,
      "currency": "eur",
      "customer": null,
      "description": null,
      "invoice": null,
      "last_payment_error": null,
      "latest_charge": `ch_${uniqueId}`,
      "livemode": false,
      "metadata": {
        // Sans order_number pour simuler le bug
      },
      "next_action": null,
      "on_behalf_of": null,
      "payment_method": `pm_${uniqueId}`,
      "payment_method_configuration_details": null,
      "payment_method_options": {
        "card": {
          "installments": null,
          "mandate_options": null,
          "network": null,
          "request_three_d_secure": "automatic"
        }
      },
      "payment_method_types": ["card"],
      "processing": null,
      "receipt_email": null, // Pas d'email pour tester la récupération depuis la charge
      "review": null,
      "setup_future_usage": null,
      "shipping": {
        "address": {
          "city": "Paris",
          "country": "FR",
          "line1": "123 Rue de Test",
          "line2": null,
          "postal_code": "75001",
          "state": null
        },
        "carrier": null,
        "name": "Client Test",
        "phone": null,
        "tracking_number": null
      },
      "source": null,
      "statement_descriptor": null,
      "statement_descriptor_suffix": null,
      "status": "succeeded",
      "transfer_data": null,
      "transfer_group": null
    }
  },
  "livemode": false,
  "pending_webhooks": 1,
  "request": { "id": null, "idempotency_key": `key_${uniqueId}` },
  "type": "payment_intent.succeeded"
};

// Événement checkout.session.completed de test
const checkoutSessionEvent = {
  "id": `evt_cs_${uniqueId}`,
  "object": "event",
  "api_version": "2024-12-18.acacia",
  "created": uniqueId + 1, // Juste après le payment_intent
  "data": {
    "object": {
      "id": sessionId,
      "object": "checkout.session",
      "amount_subtotal": 12000,
      "amount_total": 12590,
      "currency": "eur",
      "customer_details": {
        "address": {
          "city": "Paris",
          "country": "FR",
          "line1": "123 Rue de Test",
          "postal_code": "75001"
        },
        "email": testEmail,
        "name": "Client Test",
        "phone": "+33612345678"
      },
      "metadata": {
        "discount_code": "",
        "shipping_method": "standard",
        "cartId": `cart-${uniqueId}`,
        "items": "[{\"id\":\"36-EU 38-WHBLK\",\"quantity\":1,\"variant\":\"{\\\"size\\\":\\\"EU 38\\\",\\\"color\\\":\\\"WHBLK\\\",\\\"colorLabel\\\":\\\"WHBLK\\\",\\\"stock\\\":1}\"}]",
        "order_number": orderNumber  // Avec order_number
      },
      "mode": "payment",
      "payment_intent": paymentIntentId, // Même payment_intent que l'événement précédent
      "payment_method_types": ["card"],
      "payment_status": "paid",
      "shipping_details": {
        "address": {
          "city": "Paris",
          "country": "FR",
          "line1": "123 Rue de Test",
          "postal_code": "75001"
        },
        "name": "Client Test"
      },
      "status": "complete",
      "total_details": {
        "amount_discount": 0,
        "amount_shipping": 590,
        "amount_tax": 2000
      }
    }
  },
  "livemode": false,
  "pending_webhooks": 1,
  "request": { "id": null, "idempotency_key": null },
  "type": "checkout.session.completed"
};

// Test 1: Payment intent d'abord, puis checkout session
async function testPaymentIntentFirst() {
  console.log('----------------------------------------');
  console.log('Test 1: Événement payment_intent.succeeded reçu en premier');
  console.log('----------------------------------------');
  
  console.log('Payment Intent ID:', paymentIntentId);
  console.log('Session ID:', sessionId);
  console.log('Order Number:', orderNumber);
  console.log('Email client (checkout):', testEmail);

  console.log('\nTraitement de l\'événement payment_intent.succeeded...');
  await handleSuccessfulPayment(paymentIntentEvent);
  
  console.log('\nTraitement de l\'événement checkout.session.completed...');
  await handleCheckoutCompleted(checkoutSessionEvent);
}

// Test 2: Checkout session d'abord, puis payment intent
async function testCheckoutSessionFirst() {
  console.log('----------------------------------------');
  console.log('Test 2: Événement checkout.session.completed reçu en premier');
  console.log('----------------------------------------');
  
  console.log('Payment Intent ID:', paymentIntentId);
  console.log('Session ID:', sessionId);
  console.log('Order Number:', orderNumber);
  console.log('Email client (checkout):', testEmail);

  console.log('\nTraitement de l\'événement checkout.session.completed...');
  await handleCheckoutCompleted(checkoutSessionEvent);
  
  console.log('\nTraitement de l\'événement payment_intent.succeeded...');
  await handleSuccessfulPayment(paymentIntentEvent);
}

// Exécuter les tests séquentiellement
(async () => {
  try {
    await testPaymentIntentFirst();
    // On utiliserait normalement testCheckoutSessionFirst() ici aussi,
    // mais puisque nous n'avons pas de réelle base de données pour les tests,
    // les deux tests utiliseraient les mêmes IDs et entreraient en conflit
  } finally {
    console.log('----------------------------------------');
    console.log('Tests terminés.');
    console.log('Nettoyage du fichier de test...');
    fs.unlinkSync(stripeWebhooksTestPath);
    console.log('Nettoyage terminé.');
  }
})(); 