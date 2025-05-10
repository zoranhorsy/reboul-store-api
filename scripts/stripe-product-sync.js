/**
 * Script de synchronisation des produits entre la base de données Reboul et Stripe
 * 
 * Ce script permet de:
 * 1. Récupérer tous les produits actifs de la base de données
 * 2. Créer ou mettre à jour les produits correspondants dans Stripe
 * 3. Synchroniser les prix, stocks et descriptions
 * 4. Journaliser les succès et échecs pour suivi
 */

const path = require('path');
const dotenv = require('dotenv');

// Charger les variables d'environnement depuis .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
console.log('STRIPE_SECRET_KEY présent:', !!process.env.STRIPE_SECRET_KEY);

// Importer la base de données
const db = require('../db');
const pool = db; // Utiliser db directement ou ses propriétés selon la structure

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');

// Configuration
const LOG_DIR = path.join(__dirname, '../logs');
const LOG_FILE = path.join(LOG_DIR, `stripe-sync-${new Date().toISOString().split('T')[0]}.log`);
const BATCH_SIZE = 50; // Nombre de produits à traiter par lot
const MAX_PRODUCTS = process.env.MAX_PRODUCTS ? parseInt(process.env.MAX_PRODUCTS) : 0; // Limite optionnelle du nombre total de produits à traiter (0 = tous)

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
    // Récupérer les produits corner
    const cornerResult = await db.query(`
      SELECT 
        cp.id, 
        cp.name, 
        COALESCE(cp.description, 'Produit The Corner') as description, 
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
        'corner' as product_type,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', cpv.id,
              'taille', COALESCE(cpv.taille, ''),
              'couleur', COALESCE(cpv.couleur, ''),
              'stock', COALESCE(cpv.stock, 0),
              'price', COALESCE(cpv.price, cp.price),
              'active', COALESCE(cpv.active, true)
            ))
            FROM corner_product_variants cpv
            WHERE cpv.corner_product_id = cp.id AND cpv.active = true
          ),
          '[]'
        ) as variants
      FROM corner_products cp
      LEFT JOIN brands b ON cp.brand_id = b.id
      LEFT JOIN categories c ON cp.category_id = c.id
      WHERE cp.active = true
      ORDER BY cp.id
    `);
    
    // Récupérer les produits réguliers (sans old_price qui n'existe pas)
    const regularResult = await db.query(`
      SELECT 
        p.id, 
        p.name, 
        COALESCE(p.description, 'Produit Reboul') as description, 
        p.price, 
        NULL as old_price,
        p.image_url,
        p.images,
        '' as sku,
        '' as store_reference,
        '' as material,
        0 as weight,
        '' as dimensions,
        true as active,
        p.brand as brand_name,
        c.name as category_name,
        'regular' as product_type,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', pv.id,
              'taille', COALESCE(pv.taille, ''),
              'couleur', COALESCE(pv.couleur, ''),
              'stock', COALESCE(pv.stock, 0),
              'price', COALESCE(pv.price, p.price),
              'active', COALESCE(pv.active, true)
            ))
            FROM product_variants pv
            WHERE pv.products_id = p.id
          ), 
          '[]'
        ) as variants
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.price > 0
      ORDER BY p.id
    `);
    
    // Combiner les résultats
    const cornerProducts = cornerResult.rows || [];
    const regularProducts = regularResult.rows || [];
    
    log(`Récupération de ${cornerProducts.length} produits corner et ${regularProducts.length} produits réguliers`);
    
    return [...cornerProducts, ...regularProducts];
  } catch (error) {
    log(`Erreur lors de la récupération des produits: ${error.message}`, true);
    throw error;
  }
}

// Vérification si un produit existe déjà dans Stripe
async function getStripeProduct(productReference) {
  try {
    // Utiliser la méthode search au lieu de list avec metadata
    const products = await stripe.products.search({
      query: `metadata['db_product_id']:'${productReference}'`,
      limit: 1
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
    // Créer un identifiant unique basé sur le type de produit
    const uniqueId = `${product.product_type}_${product.id}`;
    
    // Vérifier si le produit existe déjà
    const existingProduct = await getStripeProduct(uniqueId);
    
    // Construire les données du produit
    const productData = {
      name: product.name,
      description: product.description || (product.product_type === 'corner' ? 'Produit The Corner' : 'Produit Reboul'),
      active: product.active,
      metadata: {
        db_product_id: uniqueId,
        product_type: product.product_type,
        original_id: product.id.toString(),
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
      log(`Produit mis à jour dans Stripe: ${product.name} (${product.product_type} ID: ${product.id})`);
    } else {
      // Créer un nouveau produit
      stripeProduct = await stripe.products.create(productData);
      log(`Nouveau produit créé dans Stripe: ${product.name} (${product.product_type} ID: ${product.id})`);
    }
    
    // Gérer les prix et les variantes
    if (product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
      await syncVariantsToStripe(product.variants, stripeProduct.id, uniqueId, product.product_type);
    } else {
      // Produit sans variante, créer ou mettre à jour le prix de base
      await syncPriceToStripe(product.price, stripeProduct.id, uniqueId);
    }
    
    return stripeProduct;
  } catch (error) {
    log(`Erreur lors de la synchronisation du produit (${product.product_type} ID: ${product.id}): ${error.message}`, true);
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
async function syncVariantsToStripe(variants, stripeProductId, dbProductId, productType) {
  try {
    for (const variant of variants) {
      if (!variant.active) continue;
      
      // Créer ou mettre à jour le prix pour cette variante
      const priceCents = Math.round(variant.price * 100);
      
      // Rechercher un prix existant pour cette variante - supprimer les metadata de la recherche
      const existingPrices = await stripe.prices.list({
        product: stripeProductId,
        active: true,
        limit: 10
      });
      
      // Filtrer les résultats manuellement pour trouver la variante correspondante
      const matchingPrice = existingPrices.data.find(price => 
        price.metadata && 
        price.metadata.variant_id === variant.id.toString()
      );
      
      if (matchingPrice) {
        // Si le prix a changé, désactiver l'ancien et en créer un nouveau
        if (matchingPrice.unit_amount !== priceCents) {
          await stripe.prices.update(matchingPrice.id, { active: false });
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
    let products = await fetchProductsFromDB();
    
    // Limiter le nombre de produits si MAX_PRODUCTS est défini
    if (MAX_PRODUCTS > 0 && products.length > MAX_PRODUCTS) {
      log(`Limitation à ${MAX_PRODUCTS} produits sur ${products.length} disponibles`);
      products = products.slice(0, MAX_PRODUCTS);
    }
    
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
    // La connexion à la base de données est gérée par le pool, pas besoin de la fermer explicitement
    // car dans notre projet db.js ne fournit pas de méthode end()
    log('Fin du script de synchronisation');
  }
}

// Exécuter le script
syncProducts(); 