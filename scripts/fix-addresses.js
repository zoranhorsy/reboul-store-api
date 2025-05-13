/**
 * Script de réparation d'urgence des adresses manquantes
 * 
 * Pour exécuter ce script: 
 * node backend/scripts/fix-addresses.js
 */

require('dotenv').config();
const db = require('../db');

async function fixMissingAddresses() {
  const client = await db.pool.connect();
  console.log('🔄 Connexion à la base de données établie');
  
  try {
    await client.query('BEGIN');
    console.log('🔄 Début de la transaction');
    
    // Récupérer toutes les commandes
    const result = await client.query('SELECT id, order_number, shipping_info FROM orders');
    console.log(`📋 Trouvé ${result.rows.length} commandes à vérifier`);
    
    let updatedCount = 0;
    
    for (const order of result.rows) {
      // Créer une version mise à jour des infos de livraison
      const currentShippingInfo = order.shipping_info || {};
      
      // Déterminer si l'adresse a besoin d'être réparée
      const needsRepair = !currentShippingInfo.hasAddress || 
                         !currentShippingInfo.isValid || 
                         !currentShippingInfo.addressType ||
                         !currentShippingInfo.address;
      
      if (needsRepair) {
        console.log(`🔄 Réparation de l'adresse pour la commande #${order.order_number}`);
        
        // Construire une nouvelle version des informations d'expédition
        const updatedShippingInfo = {
          ...currentShippingInfo,
          hasAddress: true,
          isValid: true,
          addressType: 'shipping',
          address: currentShippingInfo.address || "Non spécifiée",
          deliveryType: currentShippingInfo.deliveryType || "standard"
        };
        
        // Mettre à jour la commande
        await client.query(
          'UPDATE orders SET shipping_info = $1 WHERE id = $2',
          [updatedShippingInfo, order.id]
        );
        
        updatedCount++;
      }
    }
    
    await client.query('COMMIT');
    console.log(`✅ ${updatedCount} commandes ont été mises à jour avec succès sur ${result.rows.length} commandes`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la mise à jour des adresses:', error);
  } finally {
    client.release();
    // Fermer la connexion à la base de données
    db.pool.end();
  }
}

// Exécuter la fonction
fixMissingAddresses()
  .then(() => {
    console.log('✅ Script terminé');
  })
  .catch(err => {
    console.error('❌ Erreur non gérée:', err);
    process.exit(1);
  }); 