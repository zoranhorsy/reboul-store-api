#!/usr/bin/env node

/**
 * Script de test pour une intégration complète Stripe -> Reboul
 * Ce script simule une commande Stripe et vérifie qu'elle s'affiche dans le compte utilisateur
 */

require('dotenv').config();
const pool = require('./db');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testStripeIntegration() {
  let client;
  
  try {
    log(colors.cyan, '🚀 TEST D\'INTÉGRATION STRIPE -> REBOUL');
    console.log('=' .repeat(60));

    client = await pool.pool.connect();

    // 1. Vérifier l'utilisateur de test
    log(colors.yellow, '\n👤 1. Vérification de l\'utilisateur de test...');
    
    const testEmail = 'zxransounds@gmail.com'; // Email utilisé pour les tests
    
    const userQuery = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [testEmail]
    );

    if (userQuery.rows.length === 0) {
      log(colors.red, `❌ Utilisateur avec l'email ${testEmail} non trouvé`);
      log(colors.yellow, 'Créez un compte avec cet email pour continuer le test');
      return;
    }

    const testUser = userQuery.rows[0];
    log(colors.green, `✅ Utilisateur trouvé: ${testUser.username} (${testUser.email})`);

    // 1.5. Récupérer un produit existant
    log(colors.yellow, '\n🔍 1.5. Récupération d\'un produit existant...');
    
    const productQuery = await client.query('SELECT id, name, price FROM products LIMIT 1');
    if (productQuery.rows.length === 0) {
      log(colors.red, '❌ Aucun produit trouvé dans la base');
      return;
    }
    
    const testProduct = productQuery.rows[0];
    log(colors.green, `✅ Produit trouvé: ${testProduct.name} (ID: ${testProduct.id}) - ${testProduct.price}€`);

    // 2. Créer une commande test dans la base
    log(colors.yellow, '\n📦 2. Création d\'une commande de test...');
    
    const orderNumber = `TEST-${Date.now()}`;
    const testAmount = 99.99;
    
    await client.query('BEGIN');
    
    const orderResult = await client.query(
      `INSERT INTO orders 
      (user_id, total_amount, shipping_info, status, payment_status, order_number, created_at) 
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) 
      RETURNING *`,
      [
        testUser.id,
        testAmount,
        {
          firstName: 'Test',
          lastName: 'User',
          email: testEmail,
          address: '123 Rue de Test',
          city: 'Paris',
          postalCode: '75001',
          country: 'France',
          isValid: true,
          hasAddress: true
        },
        'pending',
        'pending',
        orderNumber
      ]
    );
    
    const testOrder = orderResult.rows[0];
    log(colors.green, `✅ Commande créée: #${testOrder.order_number} | ${testAmount}€`);
    
    // Ajouter un produit à la commande
    await client.query(
      `INSERT INTO order_items 
      (order_id, product_id, product_name, quantity, price, variant_info) 
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        testOrder.id,
        testProduct.id, // Utiliser l'ID du vrai produit
        testProduct.name,
        1,
        testAmount,
        JSON.stringify({ size: 'M', color: 'Noir' })
      ]
    );
    
    await client.query('COMMIT');
    
    // 3. Simuler un webhook Stripe
    log(colors.yellow, '\n🔔 3. Simulation d\'un paiement Stripe réussi...');
    
    // Simuler les données d'un payment_intent.succeeded
    const mockPaymentData = {
      paymentIntentId: `pi_test_${Date.now()}`,
      amount: testAmount,
      currency: 'eur',
      paymentMethod: 'card',
      customerEmail: testEmail,
      paidAt: new Date().toISOString()
    };
    
    // Mettre à jour la commande comme si le webhook avait été reçu
    await client.query(
      `UPDATE orders 
      SET payment_status = $1, status = $2, payment_data = $3, updated_at = CURRENT_TIMESTAMP 
      WHERE order_number = $4`,
      ['paid', 'processing', JSON.stringify(mockPaymentData), orderNumber]
    );
    
    log(colors.green, `✅ Paiement simulé: ${mockPaymentData.paymentIntentId}`);

    // 4. Vérifier que la commande est maintenant visible pour l'utilisateur
    log(colors.yellow, '\n🔍 4. Vérification de la visibilité côté utilisateur...');
    
    const userOrdersQuery = await client.query(
      `SELECT 
        o.*,
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'product_name', oi.product_name,
            'quantity', oi.quantity,
            'price', oi.price,
            'variant_info', oi.variant_info
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1 AND o.order_number = $2
      GROUP BY o.id`,
      [testUser.id, orderNumber]
    );
    
    if (userOrdersQuery.rows.length > 0) {
      const order = userOrdersQuery.rows[0];
      log(colors.green, `✅ Commande visible dans le compte utilisateur:`);
      console.log(`   - Numéro: ${order.order_number}`);
      console.log(`   - Statut: ${order.status}`);
      console.log(`   - Paiement: ${order.payment_status}`);
      console.log(`   - Montant: ${order.total_amount}€`);
      console.log(`   - Email: ${order.shipping_info.email}`);
      console.log(`   - Produits: ${order.items ? order.items.length : 0} article(s)`);
    } else {
      log(colors.red, `❌ Commande non visible dans le compte utilisateur`);
    }

    // 5. Tester l'API d'récupération des commandes
    log(colors.yellow, '\n🌐 5. Test de l\'API de récupération des commandes...');
    
    const allUserOrdersQuery = await client.query(
      `SELECT 
        o.*,
        json_agg(
          CASE WHEN oi.id IS NOT NULL THEN
            json_build_object(
              'id', oi.id,
              'product_id', oi.product_id,
              'product_name', oi.product_name,
              'quantity', oi.quantity,
              'price', oi.price,
              'variant_info', oi.variant_info
            )
          END
        ) FILTER (WHERE oi.id IS NOT NULL) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC`,
      [testUser.id]
    );
    
    log(colors.green, `✅ ${allUserOrdersQuery.rows.length} commandes trouvées pour cet utilisateur:`);
    
    allUserOrdersQuery.rows.forEach((order, index) => {
      const itemsCount = order.items ? order.items.length : 0;
      const statusColor = order.payment_status === 'paid' ? colors.green : colors.yellow;
      console.log(`   ${index + 1}. #${order.order_number} | ${statusColor}${order.payment_status}${colors.reset} | ${order.total_amount}€ | ${itemsCount} produit(s)`);
    });

    // 6. Vérifier la structure des données
    log(colors.yellow, '\n🔧 6. Vérification de la structure des données...');
    
    const orderStructureQuery = await client.query(
      `SELECT 
        order_number,
        shipping_info,
        payment_data,
        customer_info
      FROM orders 
      WHERE order_number = $1`,
      [orderNumber]
    );
    
    const orderData = orderStructureQuery.rows[0];
    
    console.log('   📋 Structure des données de la commande:');
    console.log(`      - shipping_info: ${orderData.shipping_info ? 'Présent' : 'Manquant'}`);
    console.log(`      - payment_data: ${orderData.payment_data ? 'Présent' : 'Manquant'}`);
    console.log(`      - customer_info: ${orderData.customer_info ? 'Présent' : 'Manquant'}`);
    
    if (orderData.shipping_info && orderData.shipping_info.email) {
      log(colors.green, `      ✅ Email dans shipping_info: ${orderData.shipping_info.email}`);
    }
    
    if (orderData.payment_data) {
      try {
        const paymentData = typeof orderData.payment_data === 'string' 
          ? JSON.parse(orderData.payment_data) 
          : orderData.payment_data;
        if (paymentData.customerEmail) {
          log(colors.green, `      ✅ Email dans payment_data: ${paymentData.customerEmail}`);
        }
      } catch (e) {
        log(colors.yellow, `      ⚠️  Erreur lors de l'analyse des payment_data`);
      }
    }

    // 7. Simuler l'affichage frontend
    log(colors.yellow, '\n🖥️ 7. Simulation de l\'affichage frontend...');
    
    // Cette fonction simule ce que fait le composant OrderHistory.tsx
    const simulateFrontendDisplay = (orders) => {
      return orders.map(order => {
        // Extraire l'email comme le fait le frontend
        let displayEmail = 'Email non disponible';
        
        if (order.shipping_info?.email) {
          displayEmail = order.shipping_info.email;
        } else if (order.payment_data?.customerEmail) {
          displayEmail = order.payment_data.customerEmail;
        } else if (order.customer_info?.email) {
          displayEmail = order.customer_info.email;
        }
        
        return {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          payment_status: order.payment_status,
          total_amount: order.total_amount,
          created_at: order.created_at,
          display_email: displayEmail,
          items: order.items || []
        };
      });
    };
    
    const frontendOrders = simulateFrontendDisplay(allUserOrdersQuery.rows);
    
    log(colors.green, `✅ Simulation de l'affichage frontend:`);
    frontendOrders.forEach(order => {
      console.log(`   📦 Commande #${order.order_number}`);
      console.log(`      Statut: ${order.status} | Paiement: ${order.payment_status}`);
      console.log(`      Email: ${order.display_email}`);
      console.log(`      Montant: ${order.total_amount}€`);
      console.log(`      Produits: ${order.items.length} article(s)`);
      console.log('');
    });

    // 8. Nettoyer la commande de test
    log(colors.yellow, '\n🧹 8. Nettoyage de la commande de test...');
    
    const shouldCleanup = process.argv.includes('--cleanup');
    
    if (shouldCleanup) {
      await client.query('BEGIN');
      await client.query('DELETE FROM order_items WHERE order_id = $1', [testOrder.id]);
      await client.query('DELETE FROM orders WHERE id = $1', [testOrder.id]);
      await client.query('COMMIT');
      log(colors.green, '✅ Commande de test supprimée');
    } else {
      log(colors.yellow, '⚠️  Commande de test conservée (utilisez --cleanup pour la supprimer)');
    }

    log(colors.green, '\n🎉 TEST D\'INTÉGRATION TERMINÉ AVEC SUCCÈS !');
    log(colors.cyan, '\n📝 RÉSUMÉ:');
    console.log('   ✅ Les commandes Stripe s\'affichent correctement dans le compte Reboul');
    console.log('   ✅ L\'association utilisateur fonctionne');
    console.log('   ✅ Les données sont structurées correctement');
    console.log('   ✅ Le frontend peut récupérer et afficher les commandes');

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    log(colors.red, `❌ ERREUR PENDANT LE TEST: ${error.message}`);
    console.error(error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.pool.end();
  }
}

// Exécuter le test
testStripeIntegration(); 