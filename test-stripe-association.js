#!/usr/bin/env node

/**
 * Script de test pour vérifier l'association des commandes Stripe avec les comptes Reboul
 * Usage: node test-stripe-association.js
 */

require('dotenv').config();
const pool = require('./db');

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

async function testStripeOrderAssociation() {
  let client;
  
  try {
    log(colors.cyan, '🔍 DÉMARRAGE DU TEST D\'ASSOCIATION STRIPE-REBOUL');
    console.log('=' .repeat(60));

    client = await pool.pool.connect();

    // 1. Vérifier les commandes sans user_id
    log(colors.yellow, '\n📋 1. Vérification des commandes orphelines...');
    const orphanOrdersQuery = await client.query(`
      SELECT 
        o.id, 
        o.order_number, 
        o.shipping_info->>'email' as shipping_email,
        o.payment_data->>'customerEmail' as payment_email,
        o.customer_info->>'email' as customer_email,
        o.total_amount,
        o.status,
        o.created_at
      FROM orders o 
      WHERE o.user_id IS NULL 
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    if (orphanOrdersQuery.rows.length > 0) {
      log(colors.red, `❌ Trouvé ${orphanOrdersQuery.rows.length} commandes orphelines :`);
      orphanOrdersQuery.rows.forEach(order => {
        const email = order.shipping_email || order.payment_email || order.customer_email || 'Aucun email';
        console.log(`   - Commande #${order.order_number} | Email: ${email} | ${order.total_amount}€ | ${order.status}`);
      });
    } else {
      log(colors.green, '✅ Aucune commande orpheline trouvée');
    }

    // 2. Vérifier les commandes associées récentes
    log(colors.yellow, '\n📋 2. Vérification des commandes associées récentes...');
    const recentOrdersQuery = await client.query(`
      SELECT 
        o.id, 
        o.order_number, 
        o.user_id,
        u.email as user_email,
        o.shipping_info->>'email' as shipping_email,
        o.total_amount,
        o.status,
        o.created_at
      FROM orders o 
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.user_id IS NOT NULL 
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    if (recentOrdersQuery.rows.length > 0) {
      log(colors.green, `✅ Trouvé ${recentOrdersQuery.rows.length} commandes associées récentes :`);
      recentOrdersQuery.rows.forEach(order => {
        const emailMatch = order.user_email === (order.shipping_email || 'N/A') ? '✅' : '⚠️';
        console.log(`   ${emailMatch} Commande #${order.order_number} | User: ${order.user_email} | ${order.total_amount}€`);
      });
    } else {
      log(colors.red, '❌ Aucune commande associée trouvée');
    }

    // 3. Tester l'association automatique
    log(colors.yellow, '\n🔄 3. Test d\'association automatique...');
    
    await client.query('BEGIN');
    
    // Rechercher les commandes orphelines avec email
    const orphansWithEmailQuery = await client.query(`
      SELECT 
        o.id, 
        o.order_number, 
        COALESCE(
          o.shipping_info->>'email',
          o.payment_data->>'customerEmail',
          o.customer_info->>'email'
        ) as email
      FROM orders o 
      WHERE o.user_id IS NULL 
      AND (
        o.shipping_info->>'email' IS NOT NULL OR
        o.payment_data->>'customerEmail' IS NOT NULL OR
        o.customer_info->>'email' IS NOT NULL
      )
      LIMIT 5
    `);

    let associatedCount = 0;
    
    for (const order of orphansWithEmailQuery.rows) {
      if (!order.email) continue;
      
      // Rechercher l'utilisateur par email
      const userQuery = await client.query(
        'SELECT id, email FROM users WHERE email = $1',
        [order.email]
      );
      
      if (userQuery.rows.length > 0) {
        const user = userQuery.rows[0];
        
        // Simuler l'association (sans la faire réellement pour le test)
        log(colors.green, `✅ ASSOCIATION POSSIBLE: Commande #${order.order_number} → User #${user.id} (${user.email})`);
        associatedCount++;
      } else {
        log(colors.yellow, `⚠️  Pas d'utilisateur trouvé pour l'email: ${order.email}`);
      }
    }

    await client.query('ROLLBACK'); // Annuler pour ne pas modifier en test

    if (associatedCount > 0) {
      log(colors.green, `✅ ${associatedCount} commandes peuvent être associées`);
    } else {
      log(colors.yellow, '⚠️  Aucune association possible pour le moment');
    }

    // 4. Vérifier les utilisateurs et leurs commandes
    log(colors.yellow, '\n👥 4. Vérification des utilisateurs avec commandes...');
    const usersWithOrdersQuery = await client.query(`
      SELECT 
        u.id,
        u.email,
        u.username,
        COUNT(o.id) as orders_count,
        SUM(o.total_amount) as total_spent
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      GROUP BY u.id, u.email, u.username
      HAVING COUNT(o.id) > 0
      ORDER BY orders_count DESC
      LIMIT 5
    `);

    if (usersWithOrdersQuery.rows.length > 0) {
      log(colors.green, `✅ Utilisateurs avec commandes :`);
      usersWithOrdersQuery.rows.forEach(user => {
        console.log(`   - ${user.username} (${user.email}) | ${user.orders_count} commandes | ${parseFloat(user.total_spent || 0).toFixed(2)}€`);
      });
    } else {
      log(colors.red, '❌ Aucun utilisateur avec commandes trouvé');
    }

    // 5. Statistiques générales
    log(colors.yellow, '\n📊 5. Statistiques générales...');
    const statsQuery = await client.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as associated_orders,
        COUNT(CASE WHEN user_id IS NULL THEN 1 END) as orphan_orders,
        SUM(total_amount) as total_revenue
      FROM orders
    `);

    const stats = statsQuery.rows[0];
    const associationRate = ((parseInt(stats.associated_orders) / parseInt(stats.total_orders)) * 100).toFixed(1);

    console.log(`   📈 Total commandes: ${stats.total_orders}`);
    console.log(`   ✅ Commandes associées: ${stats.associated_orders}`);
    console.log(`   ❌ Commandes orphelines: ${stats.orphan_orders}`);
    console.log(`   💰 Chiffre d'affaires total: ${parseFloat(stats.total_revenue || 0).toFixed(2)}€`);
    console.log(`   📊 Taux d'association: ${associationRate}%`);

    // 6. Recommandations
    log(colors.cyan, '\n💡 6. Recommandations...');
    
    if (parseInt(stats.orphan_orders) > 0) {
      log(colors.yellow, '⚠️  Actions recommandées :');
      console.log('   1. Exécuter l\'association automatique des commandes orphelines');
      console.log('   2. Vérifier les webhooks Stripe');
      console.log('   3. S\'assurer que les emails sont correctement capturés');
    } else {
      log(colors.green, '✅ Toutes les commandes sont correctement associées !');
    }

    log(colors.green, '\n🎉 TEST TERMINÉ AVEC SUCCÈS');

  } catch (error) {
    log(colors.red, `❌ ERREUR PENDANT LE TEST: ${error.message}`);
    console.error(error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.pool.end();
  }
}

// Fonction pour exécuter l'association réelle des commandes orphelines
async function runOrphanAssociation() {
  let client;
  
  try {
    log(colors.cyan, '🔄 DÉMARRAGE DE L\'ASSOCIATION DES COMMANDES ORPHELINES');
    console.log('=' .repeat(60));

    client = await pool.pool.connect();
    await client.query('BEGIN');
    
    // Rechercher les commandes orphelines avec email
    const orphanOrdersQuery = await client.query(`
      SELECT 
        o.id, 
        o.order_number, 
        COALESCE(
          o.shipping_info->>'email',
          o.payment_data->>'customerEmail',
          o.customer_info->>'email'
        ) as email
      FROM orders o 
      WHERE o.user_id IS NULL 
      AND (
        o.shipping_info->>'email' IS NOT NULL OR
        o.payment_data->>'customerEmail' IS NOT NULL OR
        o.customer_info->>'email' IS NOT NULL
      )
    `);

    const orphanOrders = orphanOrdersQuery.rows;
    log(colors.yellow, `Trouvé ${orphanOrders.length} commandes orphelines à traiter`);
    
    let associatedCount = 0;
    
    for (const order of orphanOrders) {
      if (!order.email) continue;
      
      // Rechercher l'utilisateur par email
      const userQuery = await client.query(
        'SELECT id, email FROM users WHERE email = $1',
        [order.email]
      );
      
      if (userQuery.rows.length > 0) {
        const user = userQuery.rows[0];
        
        // Associer la commande à l'utilisateur
        await client.query(
          'UPDATE orders SET user_id = $1 WHERE id = $2',
          [user.id, order.id]
        );
        
        log(colors.green, `✅ Commande #${order.order_number} associée à ${user.email}`);
        associatedCount++;
      } else {
        log(colors.yellow, `⚠️  Aucun utilisateur trouvé pour l'email: ${order.email}`);
      }
    }
    
    await client.query('COMMIT');
    
    log(colors.green, `🎉 ${associatedCount} commandes ont été associées avec succès !`);

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    log(colors.red, `❌ ERREUR: ${error.message}`);
    console.error(error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.pool.end();
  }
}

// Vérifier les arguments de ligne de commande
const args = process.argv.slice(2);

if (args.includes('--associate')) {
  runOrphanAssociation();
} else if (args.includes('--help')) {
  console.log(`
Usage: node test-stripe-association.js [options]

Options:
  --associate    Exécuter l'association réelle des commandes orphelines
  --help         Afficher cette aide

Sans option: exécuter le test (sans modifications)
  `);
} else {
  testStripeOrderAssociation();
} 