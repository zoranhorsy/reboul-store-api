const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('Test d\'envoi d\'email de confirmation de paiement Stripe');
console.log('----------------------------------------');

// Vérifier les variables d'environnement
console.log('Variables d\'environnement:');
console.log('- SMTP_HOST:', process.env.SMTP_HOST || 'Non défini ❌');
console.log('- SMTP_PORT:', process.env.SMTP_PORT || 'Non défini ❌');
console.log('- SMTP_USER:', process.env.SMTP_USER || 'Non défini ❌');
console.log('- SMTP_PASS:', process.env.SMTP_PASS ? 'Défini (masqué)' : 'Non défini ❌');
console.log('- SMTP_SECURE:', process.env.SMTP_SECURE || 'Non défini ❌');
console.log('----------------------------------------');

// Configuration SMTP détaillée
console.log('Configuration SMTP:');
console.log('Host:', process.env.SMTP_HOST);
console.log('Port:', process.env.SMTP_PORT);
console.log('User:', process.env.SMTP_USER);
console.log('Pass:', process.env.SMTP_PASS ? '[Masqué]' : 'Non défini ❌');
console.log('Secure:', process.env.SMTP_SECURE);
console.log('----------------------------------------');

// Données de test
const paymentData = {
  sessionId: 'cs_test_' + Math.random().toString(36).substring(2, 15),
  amount: 129.99,
  currency: 'eur',
  paymentMethod: 'card',
  paidAt: new Date().toISOString()
};

const orderData = {
  order_number: 'TEST' + Math.floor(Math.random() * 10000),
  shipping_info: {
    firstName: 'Client',
    lastName: 'Test',
    email: 'claude.tech.test@gmail.com',  // Remplacer par une adresse valide pour les tests
    address: '123 Rue de Test',
    city: 'Paris',
    postalCode: '75001',
    country: 'France'
  }
};

// Créer transporteur email
console.log('Création du transporteur email...');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Fonction pour formater la date en français
function formatDate(date) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('fr-FR', options);
}

// Fonction pour formater l'heure en français
function formatTime(date) {
  const options = { hour: '2-digit', minute: '2-digit' };
  return date.toLocaleTimeString('fr-FR', options);
}

// Vérifier la connexion SMTP
console.log('Vérification de la connexion SMTP...');
transporter.verify()
  .then(success => {
    console.log('Connexion SMTP vérifiée:', success ? 'Succès ✅' : 'Échec ❌');
    
    if (success) {
      console.log('Envoi de l\'email de test...');
      
      // Date et heure formatées
      const now = new Date();
      const formattedDate = formatDate(now);
      const formattedTime = formatTime(now);
      
      // Préparer l'email
      return transporter.sendMail({
        from: `"Reboul Store" <${process.env.SMTP_USER}>`,
        to: orderData.shipping_info.email,
        subject: `Confirmation de paiement pour votre commande #${orderData.order_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://reboulstore.com/images/logo_black.png" alt="Reboul Store Logo" style="max-width: 200px;">
            </div>
            
            <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: #4CAF50; text-align: center; margin-top: 0;">Paiement confirmé</h1>
              
              <p style="font-size: 16px; line-height: 1.6;">
                Bonjour ${orderData.shipping_info.firstName},
              </p>
              
              <p style="font-size: 16px; line-height: 1.6;">
                Nous vous confirmons que votre paiement pour la commande <strong>#${orderData.order_number}</strong> a été effectué avec succès le ${formattedDate} à ${formattedTime}.
              </p>
              
              <div style="background-color: #f5f5f5; border-left: 4px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h2 style="margin-top: 0; color: #333; font-size: 18px;">Récapitulatif de votre paiement</h2>
                <p style="margin: 5px 0;"><strong>Montant:</strong> ${paymentData.amount.toFixed(2)} €</p>
                <p style="margin: 5px 0;"><strong>Méthode de paiement:</strong> ${paymentData.paymentMethod || 'Carte bancaire'}</p>
                <p style="margin: 5px 0;"><strong>Numéro de transaction:</strong> ${paymentData.sessionId}</p>
              </div>
              
              <p style="font-size: 16px; line-height: 1.6;">
                Votre commande est maintenant en cours de préparation. Vous recevrez un email lorsqu'elle sera expédiée, avec les informations de suivi.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://reboulstore.com/mon-compte/commandes" style="display: inline-block; background-color: #4a4a4a; color: white; text-decoration: none; padding: 12px 25px; border-radius: 4px; font-weight: bold;">
                  Suivre ma commande
                </a>
              </div>
              
              <p style="font-size: 16px; line-height: 1.6;">
                Si vous avez des questions concernant votre commande, n'hésitez pas à nous contacter.
              </p>
              
              <p style="font-size: 16px; line-height: 1.6;">
                Merci de votre confiance !
              </p>
              
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 0;">
                L'équipe Reboul Store
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
              <p>© ${new Date().getFullYear()} Reboul Store. Tous droits réservés.</p>
              <p>
                <a href="https://reboulstore.com/confidentialite" style="color: #666; text-decoration: underline;">Politique de confidentialité</a> | 
                <a href="https://reboulstore.com/conditions" style="color: #666; text-decoration: underline;">Conditions d'utilisation</a>
              </p>
            </div>
          </div>
        `
      });
    } else {
      throw new Error('Connexion SMTP échouée');
    }
  })
  .then(info => {
    console.log('----------------------------------------');
    console.log('Email envoyé avec succès! ✅');
    console.log('Message ID:', info.messageId);
    console.log('Envoyé à:', orderData.shipping_info.email);
    console.log('----------------------------------------');
  })
  .catch(error => {
    console.error('----------------------------------------');
    console.error('Erreur lors de l\'envoi de l\'email: ❌');
    console.error('Type d\'erreur:', error.name);
    console.error('Message d\'erreur:', error.message);
    console.error('Code d\'erreur:', error.code);
    if (error.response) console.error('Réponse du serveur:', error.response);
    console.error('----------------------------------------');
  }); 