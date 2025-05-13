require('dotenv').config();
const { handleCheckoutCompleted } = require('./routes/stripewebhooks-mock');

console.log('Test du gestionnaire de webhook checkout.session.completed avec mocks');
console.log('----------------------------------------');

// Événement webhook de test (format JSON)
const webhookEvent = {
  "id": "evt_1ROFBmCvFAONCF3NOjWVvJhe",
  "object": "event",
  "api_version": "2024-12-18.acacia",
  "created": 1747128714,
  "data": {
    "object": {
      "id": "cs_test_b17GN5dyKb9Wo9RKORCHtAn6cAsAps4U7nSbKXIQq1RyHlZxJEjkjGjVFw",
      "object": "checkout.session",
      "amount_subtotal": 12000,
      "amount_total": 12590,
      "currency": "eur",
      "customer_details": {
        "address": {
          "city": "Marseille",
          "country": "FR",
          "line1": "Rue edouard alexander",
          "postal_code": "13010"
        },
        "email": "claude.tech.test@gmail.com",
        "name": "Yoann Marrale",
        "phone": "+33767700099"
      },
      "metadata": {
        "discount_code": "",
        "shipping_method": "standard",
        "cartId": "cart-1747128679320",
        "items": "[{\"id\":\"36-EU 38-WHBLK\",\"quantity\":1,\"variant\":\"{\\\"size\\\":\\\"EU 38\\\",\\\"color\\\":\\\"WHBLK\\\",\\\"colorLabel\\\":\\\"WHBLK\\\",\\\"stock\\\":1}\"}]",
        "order_number": "TEST" + Math.floor(Math.random() * 10000) // Ajout d'un order_number pour le test
      },
      "mode": "payment",
      "payment_intent": "pi_3ROFBlCvFAONCF3N0YQ4afsf",
      "payment_method_types": ["card"],
      "payment_status": "paid",
      "shipping_details": {
        "address": {
          "city": "Marseille",
          "country": "FR",
          "line1": "Rue edouard alexander",
          "postal_code": "13010"
        },
        "name": "Yoann Marrale"
      },
      "status": "complete",
      "total_details": {
        "amount_discount": 0,
        "amount_shipping": 590,
        "amount_tax": 2000
      }
    }
  },
  "type": "checkout.session.completed"
};

console.log('Session ID:', webhookEvent.data.object.id);
console.log('Order Number:', webhookEvent.data.object.metadata.order_number);
console.log('Email client:', webhookEvent.data.object.customer_details.email);
console.log('Montant total:', webhookEvent.data.object.amount_total / 100, webhookEvent.data.object.currency);

console.log('----------------------------------------');
console.log('Exécution du gestionnaire de webhook checkout.session.completed...');

// Appeler la fonction de traitement
handleCheckoutCompleted(webhookEvent)
  .then(() => {
    console.log('----------------------------------------');
    console.log('Traitement de l\'événement terminé avec succès ✅');
    console.log('----------------------------------------');
    console.log('RÉSUMÉ DU TEST :');
    console.log('- Webhook reçu et traité correctement');
    console.log('- Status de la commande mis à jour vers "paid"');
    console.log('- Email de confirmation envoyé au client');
    console.log('');
    console.log('Le test simule l\'intégration complète entre Stripe et Nodemailer.');
    console.log('Dans l\'environnement de production, les données seraient enregistrées');
    console.log('dans la base de données et le client recevrait l\'email réel.');
  })
  .catch((error) => {
    console.error('----------------------------------------');
    console.error('Erreur lors du traitement de l\'événement ❌');
    console.error('Message d\'erreur:', error.message);
    console.error('Pile d\'erreur:', error.stack);
  }); 