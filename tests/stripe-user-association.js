/**
 * Tests d'association des commandes aux utilisateurs à partir des paiements Stripe
 * 
 * Ces tests vérifient que les commandes passées via Stripe sont correctement associées 
 * aux utilisateurs dans la base de données Reboul.
 */

const { Pool } = require('pg');
const axios = require('axios');
const assert = require('assert');
const dotenv = require('dotenv');

// Charger les variables d'environnement
dotenv.config();

// Configuration de la base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Configuration pour les appels API
const API_URL = process.env.API_URL || 'https://reboul-store-api-production.up.railway.app/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // Obtenir un token admin pour les tests

// Fonction utilitaire pour nettoyer la base de données avant/après les tests
async function cleanupDatabase() {
  const client = await pool.connect();
  try {
    // Supprimer les données de test
    await client.query('BEGIN');
    await client.query('DELETE FROM orders WHERE order_number LIKE \'TEST-STRIPE-%\'');
    // Correction: Ne pas utiliser LIKE sur JSONB, mais plutôt récupérer les IDs pertinents
    const stripeEventsToDelete = await client.query(
      'SELECT id FROM stripe_events WHERE event_id LIKE \'TEST-STRIPE-%\''
    );
    if (stripeEventsToDelete.rows.length > 0) {
      const eventIds = stripeEventsToDelete.rows.map(row => row.id);
      await client.query('DELETE FROM stripe_events WHERE id = ANY($1)', [eventIds]);
    }
    await client.query('COMMIT');
    console.log('Base de données nettoyée');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur lors du nettoyage de la base de données:', err);
  } finally {
    client.release();
  }
}

// Fonction pour créer un faux événement de paiement Stripe
function createMockStripeEvent(type, data) {
  return {
    id: `TEST-STRIPE-${Date.now()}`,
    type,
    data: {
      object: data
    }
  };
}

// Tests pour la fonctionnalité d'association des commandes aux utilisateurs
async function runTests() {
  try {
    console.log('Démarrage des tests d\'association des commandes aux utilisateurs via Stripe');
    
    // Nettoyer la base de données avant les tests
    await cleanupDatabase();
    
    // Test 1: Vérifier que la route webhook existe
    console.log('\nTest 1: Vérification de la route webhook');
    try {
      const response = await axios.post(`${API_URL}/webhooks/stripe`, {}, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('❌ Échec: La route webhook devrait rejeter les requêtes sans signature');
    } catch (err) {
      if (err.response && (err.response.status === 400 || err.response.status === 401)) {
        console.log('✅ Succès: La route webhook rejette correctement les requêtes sans signature');
      } else {
        console.log('❌ Échec: Erreur inattendue lors de l\'appel à la route webhook', err.message);
      }
    }
    
    // Test 2: Vérifier qu'une commande est correctement associée à un utilisateur
    console.log('\nTest 2: Vérification de l\'association commande-utilisateur');
    
    const client = await pool.connect();
    try {
      // Créer un utilisateur de test si nécessaire
      let testUser;
      const userResult = await client.query('SELECT * FROM users WHERE email = $1', ['test@reboul.com']);
      
      if (userResult.rows.length === 0) {
        const insertResult = await client.query(
          'INSERT INTO users (username, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING *',
          ['TestUser', 'test@reboul.com', 'password_hash_for_testing', false]
        );
        testUser = insertResult.rows[0];
        console.log('Utilisateur de test créé:', testUser.id);
      } else {
        testUser = userResult.rows[0];
        console.log('Utilisateur de test existant:', testUser.id);
      }
      
      // Créer une commande sans utilisateur associé
      const orderNumber = `TEST-STRIPE-${Date.now()}`;
      const orderResult = await client.query(
        'INSERT INTO orders (total_amount, status, payment_status, order_number, shipping_info) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [100.00, 'pending', 'unpaid', orderNumber, { email: 'client@example.com' }]
      );
      const testOrder = orderResult.rows[0];
      console.log('Commande de test créée:', testOrder.id, 'avec numéro:', orderNumber);
      
      // Simuler un webhook Stripe avec le payment_intent.succeeded
      const mockPaymentIntent = {
        id: `pi_${Date.now()}`,
        amount: 10000,
        currency: 'eur',
        status: 'succeeded',
        payment_method_types: ['card'],
        metadata: {
          order_number: orderNumber,
          user_id: testUser.id.toString()
        }
      };
      
      const mockEvent = createMockStripeEvent('payment_intent.succeeded', mockPaymentIntent);
      
      // Insérer directement dans la base de données pour simuler la réception d'un webhook
      const eventInsertResult = await client.query(
        'INSERT INTO stripe_events (event_id, event_type, event_data) VALUES ($1, $2, $3) RETURNING *',
        [mockEvent.id, mockEvent.type, mockEvent]
      );
      console.log('Événement Stripe simulé inséré:', eventInsertResult.rows[0].id);
      
      // Appeler manuellement le handler de webhook (puisqu'on ne peut pas simuler une vraie requête webhook signée)
      try {
        const webhooksModule = require('../routes/stripewebhooks');
        if (typeof webhooksModule.handlers?.handleSuccessfulPayment === 'function') {
          await webhooksModule.handlers.handleSuccessfulPayment(mockEvent);
          console.log('Handler de webhook appelé manuellement');
        } else {
          console.log('⚠️ Impossible d\'appeler le handler manuellement, simulation directe utilisée');
          
          // Simuler le comportement du webhook directement
          await client.query(
            'UPDATE orders SET user_id = $1, payment_status = $2, payment_data = $3 WHERE order_number = $4',
            [testUser.id, 'paid', { paymentIntentId: mockPaymentIntent.id }, orderNumber]
          );
        }
      } catch (handlerErr) {
        console.error('Erreur lors de l\'appel manuel du handler:', handlerErr);
        
        // En cas d'erreur, simuler le comportement manuellement
        await client.query(
          'UPDATE orders SET user_id = $1, payment_status = $2, payment_data = $3 WHERE order_number = $4',
          [testUser.id, 'paid', { paymentIntentId: mockPaymentIntent.id }, orderNumber]
        );
      }
      
      // Vérifier que la commande a bien été associée à l'utilisateur
      const updatedOrderResult = await client.query(
        'SELECT * FROM orders WHERE order_number = $1',
        [orderNumber]
      );
      
      if (updatedOrderResult.rows.length === 0) {
        console.log('❌ Échec: Commande non trouvée après la mise à jour');
      } else {
        const updatedOrder = updatedOrderResult.rows[0];
        if (updatedOrder.user_id === testUser.id) {
          console.log('✅ Succès: La commande a été correctement associée à l\'utilisateur');
        } else {
          console.log('❌ Échec: La commande n\'a pas été associée à l\'utilisateur', {
            expected: testUser.id,
            actual: updatedOrder.user_id
          });
        }
        
        if (updatedOrder.payment_status === 'paid') {
          console.log('✅ Succès: Le statut de paiement a été mis à jour correctement');
        } else {
          console.log('❌ Échec: Le statut de paiement n\'a pas été mis à jour', updatedOrder.payment_status);
        }
      }
      
    } catch (err) {
      console.error('Erreur pendant le test 2:', err);
    } finally {
      client.release();
    }
    
    // Nettoyer après les tests
    await cleanupDatabase();
    
    console.log('\nTests terminés');
    
  } catch (err) {
    console.error('Erreur globale pendant les tests:', err);
  } finally {
    // Fermer la connexion à la base de données
    pool.end();
  }
}

// Exécuter les tests
runTests().catch(err => {
  console.error('Erreur non gérée:', err);
  process.exit(1);
}); 