const nodemailer = require('nodemailer');
require('dotenv').config();

// En mode test, utiliser un transporteur factice
const transporter = process.env.NODE_ENV === 'test'
    ? {
        verify: (callback) => callback(null, true),
        sendMail: (options) => Promise.resolve({ messageId: 'test-message-id' })
    }
    : nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

// Vérifier la configuration seulement en mode non-test
if (process.env.NODE_ENV !== 'test') {
    console.log('Configuration SMTP:', {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: '***' // Ne pas logger le mot de passe
        }
    });

    transporter.verify((error, success) => {
        if (error) {
            console.error('Erreur de configuration SMTP:', error);
            console.error('Détails de l\'erreur:', {
                code: error.code,
                command: error.command,
                response: error.response,
                responseCode: error.responseCode
            });
        } else {
            console.log('Serveur SMTP prêt à envoyer des emails');
        }
    });
}

const REBOUL_LOGO = 'https://res.cloudinary.com/dxen69pdo/image/upload/v1753365190/logo_w_hzhfoc.png';
const REBOUL_FOOTER = `
  <hr style="border: none; border-top: 1px solid #333; margin: 32px 0 16px;">
  <div style="text-align: center; color: #666; font-size: 0.9rem;">
    © 2024 Reboul Store. Tous droits réservés.<br>
    <a href="https://reboulstore.com/confidentialite" style="color: #bbb; text-decoration: underline;">Politique de confidentialité</a> | 
    <a href="https://reboulstore.com/conditions" style="color: #bbb; text-decoration: underline;">Conditions d’utilisation</a>
  </div>
`;
const REBOUL_INTRO = `<p style="text-align: center; color: #fff; font-size: 1.1rem; margin-bottom: 24px;">La maison Reboul vous remercie pour votre confiance.</p>`;

const sendOrderConfirmation = async (order) => {
    if (process.env.NODE_ENV === 'test') {
        return { messageId: 'test-message-id' };
    }

    try {
        if (!order.shipping_info || !order.shipping_info.email) {
            throw new Error('Email du destinataire manquant dans shipping_info');
        }
        const totalAmount = Number(order.total_amount);
        const itemsHtml = order.items ? order.items.map(item => {
            const itemPrice = Number(item.price);
            return `
                <div style="margin-bottom: 10px;">
                    <p style="margin: 0 0 4px;">Produit : <b>${item.name || ''}</b></p>
                    <p style="margin: 0 0 4px;">Quantité : ${item.quantity}</p>
                    <p style="margin: 0 0 4px;">Prix : ${isNaN(itemPrice) ? '0.00' : itemPrice.toFixed(2)} €</p>
                </div>
            `;
        }).join('') : '<p>Détails des articles non disponibles</p>';
        const mailOptions = {
            from: `"Reboul Store" <${process.env.SMTP_USER}>`,
            to: order.shipping_info.email,
            subject: `Confirmation de commande #${order.order_number}`,
            html: `
<div style="background: #111; color: #fff; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden;">
  <div style="text-align: center; padding: 32px 0 16px;">
    <img src="${REBOUL_LOGO}" alt="Logo Reboul" style="max-width: 180px; margin-bottom: 16px;" />
  </div>
  <div style="padding: 0 32px 32px;">
    <h1 style="color: #fff; text-align: center; font-size: 2rem; margin-bottom: 8px;">Confirmation de commande</h1>
    ${REBOUL_INTRO}
    <p style="text-align: center; color: #fff; font-size: 1.1rem; margin-bottom: 24px;">Bonjour <b>${order.shipping_info.firstName}</b>,<br>nous avons bien reçu votre commande n°<b>${order.order_number}</b>.</p>
    <h2 style="color: #fff; font-size: 1.2rem; margin-bottom: 8px;">Détails de la commande</h2>
    <div style="background: #222; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      ${itemsHtml}
      <p style="margin: 12px 0 0; font-weight: bold;">Total : ${isNaN(totalAmount) ? '0.00' : totalAmount.toFixed(2)} €</p>
    </div>
    <h2 style="color: #fff; font-size: 1.2rem; margin-bottom: 8px;">Adresse de livraison</h2>
    <div style="background: #222; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <p style="margin: 0;">${order.shipping_info.firstName} ${order.shipping_info.lastName}</p>
      <p style="margin: 0;">${order.shipping_info.address}</p>
      <p style="margin: 0;">${order.shipping_info.postalCode} ${order.shipping_info.city}</p>
      <p style="margin: 0;">${order.shipping_info.country}</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://reboulstore.com/mon-compte/commandes" style="display: inline-block; background: #fff; color: #111; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 1.1rem;">Suivre ma commande</a>
    </div>
    <p style="text-align: center; color: #bbb; font-size: 0.95rem;">Besoin d’aide ? Contactez-nous à <a href="mailto:contact@reboulstore.com" style="color: #fff;">contact@reboulstore.com</a></p>
    ${REBOUL_FOOTER}
  </div>
</div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Erreur détaillée lors de l\'envoi de l\'email:', error);
        throw error;
    }
};

/**
 * Envoie un email de confirmation après un paiement réussi via Stripe
 * @param {Object} paymentData - Données du paiement Stripe
 * @param {Object} orderData - Données de la commande
 * @returns {Promise<Object>} - Résultat de l'envoi de l'email
 */
const sendStripePaymentConfirmation = async (paymentData, orderData) => {
    if (process.env.NODE_ENV === 'test') {
        return { messageId: 'test-message-id' };
    }
    try {
        if (!orderData.shipping_info || !orderData.shipping_info.email) {
            throw new Error('Email du destinataire manquant dans shipping_info');
        }
        const now = new Date();
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        const formattedDate = now.toLocaleDateString('fr-FR', dateOptions);
        const formattedTime = now.toLocaleTimeString('fr-FR', timeOptions);
        const amount = (typeof paymentData.amount === 'number') 
            ? paymentData.amount.toFixed(2) 
            : Number(paymentData.amount).toFixed(2);
        const mailOptions = {
            from: `"Reboul Store" <${process.env.SMTP_USER}>`,
            to: orderData.shipping_info.email,
            subject: `Confirmation de paiement pour votre commande #${orderData.order_number}`,
            html: `
<div style="background: #111; color: #fff; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden;">
  <div style="text-align: center; padding: 32px 0 16px;">
    <img src="${REBOUL_LOGO}" alt="Logo Reboul" style="max-width: 180px; margin-bottom: 16px;" />
  </div>
  <div style="padding: 0 32px 32px;">
    <h1 style="color: #fff; text-align: center; font-size: 2rem; margin-bottom: 8px;">Paiement confirmé</h1>
    ${REBOUL_INTRO}
    <p style="text-align: center; color: #fff; font-size: 1.1rem; margin-bottom: 24px;">Bonjour <b>${orderData.shipping_info.firstName}</b>,<br>Votre paiement pour la commande <b>#${orderData.order_number}</b> a été effectué avec succès le ${formattedDate} à ${formattedTime}.</p>
    <div style="background: #222; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <h2 style="color: #fff; font-size: 1.2rem; margin-bottom: 8px;">Récapitulatif du paiement</h2>
      <p style="margin: 5px 0;"><strong>Montant :</strong> ${amount} €</p>
      <p style="margin: 5px 0;"><strong>Méthode de paiement :</strong> ${paymentData.paymentMethod || 'Carte bancaire'}</p>
      <p style="margin: 5px 0;"><strong>Numéro de transaction :</strong> ${paymentData.sessionId || paymentData.paymentIntentId}</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://reboulstore.com/mon-compte/commandes" style="display: inline-block; background: #fff; color: #111; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 1.1rem;">Suivre ma commande</a>
    </div>
    <p style="text-align: center; color: #bbb; font-size: 0.95rem;">Besoin d’aide ? Contactez-nous à <a href="mailto:contact@reboulstore.com" style="color: #fff;">contact@reboulstore.com</a></p>
    ${REBOUL_FOOTER}
  </div>
</div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email de confirmation de paiement Stripe:', error);
        throw error;
    }
};

/**
 * Envoie un email de notification de changement de statut de commande
 * @param {Object} order - Données de la commande
 * @param {string} previousStatus - Ancien statut
 * @param {string} newStatus - Nouveau statut
 * @returns {Promise<Object>} - Résultat de l'envoi de l'email
 */
const sendOrderStatusNotification = async (order, previousStatus, newStatus) => {
    if (process.env.NODE_ENV === 'test') {
        return { messageId: 'test-message-id' };
    }
    try {
        if (!order.shipping_info || !order.shipping_info.email) {
            throw new Error('Email du destinataire manquant dans shipping_info');
        }
        const now = new Date();
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        const formattedDate = now.toLocaleDateString('fr-FR', dateOptions);
        const formattedTime = now.toLocaleTimeString('fr-FR', timeOptions);
        const totalAmount = Number(order.total_amount);
        const templates = {
            processing: {
                titre: 'Commande en préparation',
                message: 'Votre commande est en cours de préparation dans nos entrepôts.'
            },
            shipped: {
                titre: 'Commande expédiée',
                message: 'Votre commande a été expédiée et est en route vers vous.'
            },
            delivered: {
                titre: 'Commande livrée',
                message: 'Votre commande a été livrée avec succès.'
            },
            cancelled: {
                titre: 'Commande annulée',
                message: 'Votre commande a été annulée. Pour toute question, contactez-nous.'
            },
            return_requested: {
                titre: 'Demande de retour enregistrée',
                message: 'Nous avons bien reçu votre demande de retour. Notre équipe va la traiter dans les plus brefs délais.'
            },
            return_approved: {
                titre: 'Retour validé',
                message: 'Votre demande de retour a été validée. Vous pouvez procéder à l’envoi du produit.'
            },
            return_rejected: {
                titre: 'Retour refusé',
                message: order.admin_comment ? `Motif : ${order.admin_comment}` : 'Votre demande de retour a été refusée.'
            },
            refunded: {
                titre: 'Remboursement effectué',
                message: 'Votre remboursement a bien été effectué. Le montant sera crédité sur votre moyen de paiement dans les prochains jours.'
            }
        };
        const template = templates[newStatus] || { titre: 'Mise à jour de commande', message: '' };
        const mailOptions = {
            from: `"Reboul Store" <${process.env.SMTP_USER}>`,
            to: order.shipping_info.email,
            subject: `${template.titre} - Commande #${order.order_number}`,
            html: `
<div style="background: #111; color: #fff; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden;">
  <div style="text-align: center; padding: 32px 0 16px;">
    <img src="${REBOUL_LOGO}" alt="Logo Reboul" style="max-width: 180px; margin-bottom: 16px;" />
  </div>
  <div style="padding: 0 32px 32px;">
    <h1 style="color: #fff; text-align: center; font-size: 2rem; margin-bottom: 8px;">${template.titre}</h1>
    ${REBOUL_INTRO}
    <p style="text-align: center; color: #fff; font-size: 1.1rem; margin-bottom: 24px;">Bonjour <b>${order.shipping_info.firstName}</b>,<br>${template.message}</p>
    <div style="background: #222; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <h2 style="color: #fff; font-size: 1.2rem; margin-bottom: 8px;">Détails de la commande</h2>
      <p style="margin: 5px 0;"><strong>Numéro de commande :</strong> ${order.order_number}</p>
      <p style="margin: 5px 0;"><strong>Montant total :</strong> ${isNaN(totalAmount) ? '0.00' : totalAmount.toFixed(2)} €</p>
      <p style="margin: 5px 0;"><strong>Date :</strong> ${formattedDate} à ${formattedTime}</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://reboulstore.com/mon-compte/commandes" style="display: inline-block; background: #fff; color: #111; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 1.1rem;">Suivre ma commande</a>
    </div>
    <p style="text-align: center; color: #bbb; font-size: 0.95rem;">Besoin d’aide ? Contactez-nous à <a href="mailto:contact@reboulstore.com" style="color: #fff;">contact@reboulstore.com</a></p>
    ${REBOUL_FOOTER}
  </div>
</div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error(`Erreur lors de l'envoi de l'email de notification de statut ${newStatus}:`, error);
        throw error;
    }
};

/**
 * Envoie un email avec numéro de suivi
 * @param {Object} order - Données de la commande
 * @param {string} trackingNumber - Numéro de suivi
 * @param {string} carrier - Transporteur (optionnel)
 * @returns {Promise<Object>} - Résultat de l'envoi de l'email
 */
const sendTrackingNotification = async (order, trackingNumber, carrier = null) => {
    if (process.env.NODE_ENV === 'test') {
        return { messageId: 'test-message-id' };
    }
    try {
        if (!order.shipping_info || !order.shipping_info.email) {
            throw new Error('Email du destinataire manquant dans shipping_info');
        }
        const now = new Date();
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        const formattedDate = now.toLocaleDateString('fr-FR', dateOptions);
        const formattedTime = now.toLocaleTimeString('fr-FR', timeOptions);
        const totalAmount = Number(order.total_amount);
        const mailOptions = {
            from: `"Reboul Store" <${process.env.SMTP_USER}>`,
            to: order.shipping_info.email,
            subject: `Numéro de suivi pour votre commande #${order.order_number}`,
            html: `
<div style="background: #111; color: #fff; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden;">
  <div style="text-align: center; padding: 32px 0 16px;">
    <img src="${REBOUL_LOGO}" alt="Logo Reboul" style="max-width: 180px; margin-bottom: 16px;" />
  </div>
  <div style="padding: 0 32px 32px;">
    <h1 style="color: #fff; text-align: center; font-size: 2rem; margin-bottom: 8px;">Suivi de votre commande</h1>
    ${REBOUL_INTRO}
    <p style="text-align: center; color: #fff; font-size: 1.1rem; margin-bottom: 24px;">Bonjour <b>${order.shipping_info.firstName}</b>,<br>Votre commande est maintenant en transit. Voici votre numéro de suivi :</p>
    <div style="background: #222; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <h2 style="color: #fff; font-size: 1.2rem; margin-bottom: 8px;">Informations de suivi</h2>
      <p style="margin: 5px 0;"><strong>Numéro de commande :</strong> ${order.order_number}</p>
      <p style="margin: 5px 0;"><strong>Numéro de suivi :</strong> <span style="font-family: monospace; background-color: #e9ecef; padding: 2px 6px; border-radius: 3px; font-size: 14px; color: #111;">${trackingNumber}</span></p>
      ${carrier ? `<p style="margin: 5px 0;"><strong>Transporteur :</strong> ${carrier}</p>` : ''}
      <p style="margin: 5px 0;"><strong>Date d'expédition :</strong> ${formattedDate} à ${formattedTime}</p>
    </div>
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://reboulstore.com/mon-compte/commandes/${order.id}" style="display: inline-block; background: #fff; color: #111; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 1.1rem;">Suivre ma commande</a>
    </div>
    <p style="text-align: center; color: #bbb; font-size: 0.95rem;">Besoin d’aide ? Contactez-nous à <a href="mailto:contact@reboulstore.com" style="color: #fff;">contact@reboulstore.com</a></p>
    ${REBOUL_FOOTER}
  </div>
</div>
            `
        };
        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email de notification de suivi:', error);
        throw error;
    }
};

/**
 * Envoie un message de contact à l'adresse support
 * @param {Object} param0
 * @param {string} param0.name
 * @param {string} param0.email
 * @param {string} param0.message
 * @returns {Promise<Object>} Résultat de l'envoi
 */
const sendContactMessage = async ({ name, email, message }) => {
    if (process.env.NODE_ENV === 'test') {
        return { messageId: 'test-message-id' };
    }
    if (!name || !email || !message) {
        throw new Error('Champs manquants');
    }
    const mailOptions = {
        from: `Contact Reboul <${process.env.SMTP_USER}>`,
        to: 'horsydevservices@gmail.com',
        subject: `Nouveau message de contact de ${name}`,
        html: `
<div style="background: #111; color: #fff; font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border-radius: 12px; overflow: hidden;">
  <div style="text-align: center; padding: 32px 0 16px;">
    <img src="${REBOUL_LOGO}" alt="Logo Reboul" style="max-width: 180px; margin-bottom: 16px;" />
  </div>
  <div style="padding: 0 32px 32px;">
    <h1 style="color: #fff; text-align: center; font-size: 2rem; margin-bottom: 8px;">Nouveau message de contact</h1>
    ${REBOUL_INTRO}
    <p style="text-align: center; color: #fff; font-size: 1.1rem; margin-bottom: 24px;">Vous avez reçu un nouveau message via le formulaire de contact du site Reboul Store.</p>
    <div style="background: #222; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <h2 style="color: #fff; font-size: 1.2rem; margin-bottom: 8px;">Détails du message</h2>
      <p style="margin: 5px 0;"><strong>Nom :</strong> ${name}</p>
      <p style="margin: 5px 0;"><strong>Email :</strong> ${email}</p>
      <p style="margin: 5px 0;"><strong>Message :</strong><br>${message.replace(/\n/g, '<br>')}</p>
    </div>
    <p style="text-align: center; color: #bbb; font-size: 0.95rem;">Pour répondre, écrivez à <a href="mailto:${email}" style="color: #fff;">${email}</a></p>
    ${REBOUL_FOOTER}
  </div>
</div>
        `
    };
    const info = await transporter.sendMail(mailOptions);
    return info;
};

module.exports = {
    sendOrderConfirmation,
    sendStripePaymentConfirmation,
    sendOrderStatusNotification,
    sendTrackingNotification,
    sendContactMessage
}; 