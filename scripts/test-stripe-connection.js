/**
 * Script de test de connexion à l'API Stripe
 */

const path = require('path');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Afficher si la clé est présente (sans montrer la clé elle-même)
console.log('STRIPE_SECRET_KEY présent:', !!process.env.STRIPE_SECRET_KEY);

// Si la clé n'est pas définie dans .env, décommentez la ligne suivante et ajoutez votre clé de test
// const stripeKey = 'sk_test_...'; // Remplacez par votre clé de test
const stripeKey = process.env.STRIPE_SECRET_KEY;

// Initialiser Stripe avec la clé
const stripe = require('stripe')(stripeKey);

// Test de connexion simple
async function testStripeConnection() {
  try {
    console.log('Test de connexion à Stripe...');
    const balance = await stripe.balance.retrieve();
    console.log('Connexion réussie!');
    console.log('Balance disponible:', balance.available);
    return true;
  } catch (error) {
    console.error('Erreur de connexion à Stripe:', error.message);
    return false;
  }
}

// Exécuter le test
testStripeConnection()
  .then(success => {
    if (success) {
      console.log('Le test de connexion a réussi. Vous pouvez maintenant exécuter le script de synchronisation.');
    } else {
      console.log('Le test de connexion a échoué. Vérifiez votre clé API et réessayez.');
    }
    process.exit(success ? 0 : 1);
  }); 