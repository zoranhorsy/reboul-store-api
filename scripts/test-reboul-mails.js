const { sendOrderConfirmation, sendStripePaymentConfirmation, sendOrderStatusNotification, sendTrackingNotification, sendContactMessage } = require('../config/mailer');

const testEmail = process.env.TEST_EMAIL || 'horsydevservices@gmail.com';

async function main() {
  // 1. Confirmation de commande
  await sendOrderConfirmation({
    order_number: 'RB20240001',
    total_amount: 249.99,
    items: [
      { name: 'Chemise Reboul', quantity: 1, price: 129.99 },
      { name: 'Jean Reboul', quantity: 1, price: 120.00 }
    ],
    shipping_info: {
      email: testEmail,
      firstName: 'Jean',
      lastName: 'Dupont',
      address: '12 rue de la Paix',
      postalCode: '75002',
      city: 'Paris',
      country: 'France'
    }
  });
  console.log('Confirmation de commande envoyée');

  // 2. Confirmation de paiement Stripe
  await sendStripePaymentConfirmation({
    amount: 249.99,
    paymentMethod: 'Carte bancaire',
    sessionId: 'sess_1234567890'
  }, {
    order_number: 'RB20240001',
    shipping_info: {
      email: testEmail,
      firstName: 'Jean',
      lastName: 'Dupont',
      address: '12 rue de la Paix',
      postalCode: '75002',
      city: 'Paris',
      country: 'France'
    }
  });
  console.log('Confirmation de paiement Stripe envoyée');

  // 3. Notification de statut (préparation, expédition, livraison, retour, remboursement)
  const statuts = ['processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'return_approved', 'return_rejected', 'refunded'];
  for (const statut of statuts) {
    await sendOrderStatusNotification({
      order_number: 'RB20240001',
      total_amount: 249.99,
      shipping_info: {
        email: testEmail,
        firstName: 'Jean',
        lastName: 'Dupont',
        address: '12 rue de la Paix',
        postalCode: '75002',
        city: 'Paris',
        country: 'France'
      },
      admin_comment: statut === 'return_rejected' ? 'Produit porté' : undefined
    }, null, statut);
    console.log(`Notification de statut ${statut} envoyée`);
  }

  // 4. Notification de suivi
  await sendTrackingNotification({
    order_number: 'RB20240001',
    total_amount: 249.99,
    shipping_info: {
      email: testEmail,
      firstName: 'Jean',
      lastName: 'Dupont',
      address: '12 rue de la Paix',
      postalCode: '75002',
      city: 'Paris',
      country: 'France'
    },
    id: 1234
  }, 'TRACK123456789', 'Colissimo');
  console.log('Notification de suivi envoyée');

  // 5. Message de contact
  await sendContactMessage({
    name: 'Jean Dupont',
    email: 'jean.dupont@example.com',
    message: 'Bonjour, ceci est un test du formulaire de contact.'
  });
  console.log('Message de contact envoyé');
}

main().then(() => {
  console.log('Tous les emails de test ont été envoyés.');
  process.exit(0);
}).catch((err) => {
  console.error('Erreur lors de l\'envoi des emails de test:', err);
  process.exit(1);
}); 