const { Pool } = require('pg');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function syncPromoCodes() {
  const client = await pool.connect();
  
  try {
    // Récupérer tous les codes promo actifs de notre base de données
    const { rows: promoCodes } = await client.query(
      'SELECT * FROM discount_codes WHERE active = true'
    );

    // Pour chaque code promo
    for (const promo of promoCodes) {
      try {
        // Vérifier si le coupon existe déjà dans Stripe
        const existingCoupons = await stripe.coupons.list({
          code: promo.code,
          limit: 1
        });

        if (existingCoupons.data.length > 0) {
          // Mettre à jour le coupon existant
          await stripe.coupons.update(existingCoupons.data[0].id, {
            percent_off: promo.type === 'percentage' ? promo.value : null,
            amount_off: promo.type === 'fixed' ? Math.round(promo.value * 100) : null,
            currency: 'eur',
            duration: 'forever',
            max_redemptions: promo.max_uses || null,
          });
          console.log(`Coupon Stripe mis à jour: ${promo.code}`);
        } else {
          // Créer un nouveau coupon
          await stripe.coupons.create({
            code: promo.code,
            percent_off: promo.type === 'percentage' ? promo.value : null,
            amount_off: promo.type === 'fixed' ? Math.round(promo.value * 100) : null,
            currency: 'eur',
            duration: 'forever',
            max_redemptions: promo.max_uses || null,
          });
          console.log(`Nouveau coupon Stripe créé: ${promo.code}`);
        }
      } catch (error) {
        console.error(`Erreur lors de la synchronisation du code ${promo.code}:`, error);
      }
    }

    console.log('Synchronisation des codes promo terminée');
  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error);
  } finally {
    client.release();
  }
}

// Exécuter la synchronisation
syncPromoCodes().catch(console.error); 