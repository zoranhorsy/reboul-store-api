/**
 * Script de synchronisation des produits entre la base de données Reboul et Stripe
 * 
 * Ce script permet de:
 * 1. Récupérer tous les produits actifs de la base de données
 * 2. Créer ou mettre à jour les produits correspondants dans Stripe
 * 3. Synchroniser les prix, stocks et descriptions
 * 4. Journaliser les succès et échecs pour suivi
 */

require('dotenv').config();
const pool = require('../db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');
const path = require('path');

// Configuration
const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, `stripe-sync-${new Date().toISOString().split('T')[0]}.log`);
const BATCH_SIZE = 50; // Nombre de produits à traiter par lot

// Vérification du répertoire de logs
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Fonction pour logger
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${isError ? 'ERROR: ' : ''}${message}\n`;
  fs.appendFileSync(LOG_FILE, logEntry);
  console.log(logEntry.trim());
}

// Récupération des produits depuis la base de données
async function fetchProductsFromDB() {
  try {
    const result = await pool.query(`
      SELECT 
        cp.id, 
        cp.name, 
        cp.description, 
        cp.price, 
        cp.old_price,
        cp.image_url,
        cp.images,
        cp.sku,
        cp.store_reference,
        cp.material,
        cp.weight,
        cp.dimensions,
        cp.active,
        b.name as brand_name,
        c.name as category_name,
        (
          SELECT json_agg(json_build_object(
            'id', cpv.id,
            'taille', cpv.taille,
            'couleur', cpv.couleur,
            'stock', cpv.stock,
            'price', cpv.price,
            'active', cpv.active
          ))
          FROM corner_product_variants cpv
          WHERE cpv.corner_product_id = cp.id AND cpv.active = true
        ) as variants
      FROM corner_products cp
      LEFT JOIN brands b ON cp.brand_id = b.id
      LEFT JOIN categories c ON cp.category_id = c.id
      WHERE cp.active = true
      ORDER BY cp.id
    `);
    return result.rows;
  } catch (error) {
    log(`Erreur lors de la récupération des produits: ${error.message}`, true);
    throw error;
  }
}

// Vérification si un produit existe déjà dans Stripe
async function getStripeProduct(productReference) {
  try {
    const products = await stripe.products.list({
      limit: 1,
      active: true,
      metadata: { db_product_id: productReference.toString() }
    });
    return products.data.length > 0 ? products.data[0] : null;
  } catch (error) {
    log(`Erreur lors de la recherche du produit Stripe (ID: ${productReference}): ${error.message}`, true);
    return null;
  }
}

// Création ou mise à jour d'un produit dans Stripe
async function syncProductToStripe(product) {
  try {
    // Vérifier si le produit existe déjà
    const existingProduct = await getStripeProduct(product.id);
    
    // Construire les données du produit
    const productData = {
      name: product.name,
      description: product.description || '',
      active: product.active,
      metadata: {
        db_product_id: product.id.toString(),
        brand: product.brand_name || '',
        category: product.category_name || '',
        sku: product.sku || '',
        store_reference: product.store_reference || '',
        material: product.material || '',
        weight: product.weight ? product.weight.toString() : '',
        dimensions: product.dimensions || ''
      }
    };
    
    // Ajouter l'image si disponible
    if (product.image_url) {
      productData.images = [product.image_url];
    } else if (product.images && product.images.length > 0) {
      productData.images = product.images.slice(0, 8); // Stripe limite à 8 images
    }
    
    // Créer ou mettre à jour le produit
    let stripeProduct;
    if (existingProduct) {
      // Mettre à jour le produit existant
      stripeProduct = await stripe.products.update(existingProduct.id, productData);
      log(`Produit mis à jour dans Stripe: ${product.name} (ID: ${product.id})`);
    } else {
      // Créer un nouveau produit
      stripeProduct = await stripe.products.create(productData);
      log(`Nouveau produit créé dans Stripe: ${product.name} (ID: ${product.id})`);
    }
    
    // Gérer les prix et les variantes
    if (product.variants && product.variants.length > 0) {
      await syncVariantsToStripe(product.variants, stripeProduct.id, product.id);
    } else {
      // Produit sans variante, créer ou mettre à jour le prix de base
      await syncPriceToStripe(product.price, stripeProduct.id, product.id);
    }
    
    return stripeProduct;
  } catch (error) {
    log(`Erreur lors de la synchronisation du produit (ID: ${product.id}): ${error.message}`, true);
    return null;
  }
}

// Synchronisation des prix pour un produit sans variantes
async function syncPriceToStripe(priceAmount, stripeProductId, dbProductId) {
  try {
    // Vérifier si un prix actif existe déjà pour ce produit
    const existingPrices = await stripe.prices.list({
      product: stripeProductId,
      active: true,
      limit: 1
    });
    
    // Convertir le prix en centimes (Stripe utilise les centimes)
    const priceCents = Math.round(priceAmount * 100);
    
    if (existingPrices.data.length > 0) {
      const existingPrice = existingPrices.data[0];
      
      // Si le prix a changé, désactiver l'ancien et en créer un nouveau
      if (existingPrice.unit_amount !== priceCents) {
        await stripe.prices.update(existingPrice.id, { active: false });
        await createStripePrice(priceCents, stripeProductId, dbProductId);
      }
    } else {
      // Aucun prix existant, créer un nouveau
      await createStripePrice(priceCents, stripeProductId, dbProductId);
    }
  } catch (error) {
    log(`Erreur lors de la synchronisation du prix (Produit ID: ${dbProductId}): ${error.message}`, true);
  }
}

// Création d'un nouveau prix dans Stripe
async function createStripePrice(amountCents, stripeProductId, dbProductId, variantInfo = null) {
  try {
    const metadata = { db_product_id: dbProductId.toString() };
    
    // Ajouter les infos de variante si disponibles
    if (variantInfo) {
      metadata.variant_id = variantInfo.id.toString();
      metadata.taille = variantInfo.taille || '';
      metadata.couleur = variantInfo.couleur || '';
    }
    
    const price = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: amountCents,
      currency: 'eur',
      metadata
    });
    
    log(`Nouveau prix créé: ${amountCents/100}€ (Produit ID: ${dbProductId}${variantInfo ? `, Variante: ${variantInfo.taille || ''} ${variantInfo.couleur || ''}` : ''})`);
    return price;
  } catch (error) {
    log(`Erreur lors de la création du prix (Produit ID: ${dbProductId}): ${error.message}`, true);
    return null;
  }
}

// Synchronisation des variantes
async function syncVariantsToStripe(variants, stripeProductId, dbProductId) {
  try {
    for (const variant of variants) {
      if (!variant.active) continue;
      
      // Créer ou mettre à jour le prix pour cette variante
      const priceCents = Math.round(variant.price * 100);
      
      // Rechercher un prix existant pour cette variante
      const existingPrices = await stripe.prices.list({
        product: stripeProductId,
        active: true,
        limit: 10,
        metadata: { variant_id: variant.id.toString() }
      });
      
      if (existingPrices.data.length > 0) {
        const existingPrice = existingPrices.data[0];
        
        // Si le prix a changé, désactiver l'ancien et en créer un nouveau
        if (existingPrice.unit_amount !== priceCents) {
          await stripe.prices.update(existingPrice.id, { active: false });
          await createStripePrice(priceCents, stripeProductId, dbProductId, variant);
        }
      } else {
        // Aucun prix existant pour cette variante, créer un nouveau
        await createStripePrice(priceCents, stripeProductId, dbProductId, variant);
      }
    }
  } catch (error) {
    log(`Erreur lors de la synchronisation des variantes (Produit ID: ${dbProductId}): ${error.message}`, true);
  }
}

// Fonction principale
async function syncProducts() {
  try {
    log('Démarrage de la synchronisation des produits avec Stripe...');
    
    // Récupérer tous les produits depuis la base de données
    const products = await fetchProductsFromDB();
    log(`${products.length} produits actifs trouvés dans la base de données`);
    
    // Variables pour les statistiques
    let successCount = 0;
    let errorCount = 0;
    
    // Traiter les produits par lots pour éviter les limitations d'API
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      log(`Traitement du lot ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(products.length/BATCH_SIZE)} (${batch.length} produits)`);
      
      // Traiter chaque produit du lot
      for (const product of batch) {
        const result = await syncProductToStripe(product);
        if (result) {
          successCount++;
        } else {
          errorCount++;
        }
      }
      
      // Pause entre les lots pour éviter les limitations d'API
      if (i + BATCH_SIZE < products.length) {
        log(`Pause de 2 secondes avant le prochain lot...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Afficher les statistiques finales
    log('Synchronisation terminée!');
    log(`Résultats: ${successCount} produits synchronisés avec succès, ${errorCount} erreurs`);
    
  } catch (error) {
    log(`Erreur lors de la synchronisation: ${error.message}`, true);
  } finally {
    // Fermer la connexion à la base de données
    pool.end();
  }
}

// Exécuter le script
syncProducts(); 