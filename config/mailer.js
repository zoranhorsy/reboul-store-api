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

const sendOrderConfirmation = async (order) => {
    if (process.env.NODE_ENV === 'test') {
        return { messageId: 'test-message-id' };
    }

    try {
        console.log('Données de la commande reçues:', order);

        console.log('Tentative d\'envoi d\'email pour la commande:', {
            orderNumber: order.order_number,
            email: order.shipping_info.email,
            totalAmount: order.total_amount
        });

        if (!order.shipping_info || !order.shipping_info.email) {
            throw new Error('Email du destinataire manquant dans shipping_info');
        }

        // Conversion explicite du montant total en nombre
        const totalAmount = Number(order.total_amount);
        if (isNaN(totalAmount)) {
            console.error('Montant total invalide:', order.total_amount);
            throw new Error('Montant total invalide');
        }

        const mailOptions = {
            from: `"Reboul Store" <${process.env.SMTP_USER}>`,
            to: order.shipping_info.email,
            subject: `Confirmation de commande #${order.order_number}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h1 style="color: #333; text-align: center;">Merci pour votre commande !</h1>
                    <p>Bonjour ${order.shipping_info.firstName},</p>
                    <p>Nous avons bien reçu votre commande n°${order.order_number}.</p>
                    
                    <h2 style="color: #666;">Détails de la commande</h2>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
                        <h3>Articles</h3>
                        ${order.items ? order.items.map(item => {
                            const itemPrice = Number(item.price);
                            return `
                                <div style="margin-bottom: 10px;">
                                    <p style="margin: 0;">Quantité: ${item.quantity}</p>
                                    <p style="margin: 0;">Prix: ${isNaN(itemPrice) ? '0.00' : itemPrice.toFixed(2)}€</p>
                                </div>
                            `;
                        }).join('') : '<p>Détails des articles non disponibles</p>'}
                        <h3 style="margin-top: 20px;">Total: ${totalAmount.toFixed(2)}€</h3>
                    </div>

                    <h2 style="color: #666; margin-top: 30px;">Adresse de livraison</h2>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
                        <p style="margin: 0;">${order.shipping_info.firstName} ${order.shipping_info.lastName}</p>
                        <p style="margin: 0;">${order.shipping_info.address}</p>
                        <p style="margin: 0;">${order.shipping_info.postalCode} ${order.shipping_info.city}</p>
                        <p style="margin: 0;">${order.shipping_info.country}</p>
                    </div>

                    <p style="margin-top: 30px;">
                        Nous vous tiendrons informé de l'avancement de votre commande.
                    </p>
                    
                    <div style="text-align: center; margin-top: 40px; padding: 20px; background: #f0f0f0;">
                        <p style="margin: 0;">Besoin d'aide ?</p>
                        <p style="margin: 5px 0;">
                            Contactez-nous à 
                            <a href="mailto:contact@reboulstore.com" style="color: #007bff;">
                                contact@reboulstore.com
                            </a>
                        </p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email envoyé avec succès:', {
            messageId: info.messageId,
            response: info.response,
            accepted: info.accepted,
            rejected: info.rejected
        });
        return info;
    } catch (error) {
        console.error('Erreur détaillée lors de l\'envoi de l\'email:', {
            name: error.name,
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode,
            stack: error.stack
        });
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
        console.log('Envoi de confirmation de paiement Stripe pour la commande:', orderData.order_number);

        if (!orderData.shipping_info || !orderData.shipping_info.email) {
            throw new Error('Email du destinataire manquant dans shipping_info');
        }

        // Date et heure formatées
        const now = new Date();
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };
        const formattedDate = now.toLocaleDateString('fr-FR', dateOptions);
        const formattedTime = now.toLocaleTimeString('fr-FR', timeOptions);

        // Formater le montant (s'assurer qu'il s'agit d'un nombre)
        const amount = (typeof paymentData.amount === 'number') 
            ? paymentData.amount.toFixed(2) 
            : Number(paymentData.amount).toFixed(2);

        const mailOptions = {
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
                            <p style="margin: 5px 0;"><strong>Montant:</strong> ${amount} €</p>
                            <p style="margin: 5px 0;"><strong>Méthode de paiement:</strong> ${paymentData.paymentMethod || 'Carte bancaire'}</p>
                            <p style="margin: 5px 0;"><strong>Numéro de transaction:</strong> ${paymentData.sessionId || paymentData.paymentIntentId}</p>
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
                        <p>© 2023 Reboul Store. Tous droits réservés.</p>
                        <p>
                            <a href="https://reboulstore.com/confidentialite" style="color: #666; text-decoration: underline;">Politique de confidentialité</a> | 
                            <a href="https://reboulstore.com/conditions" style="color: #666; text-decoration: underline;">Conditions d'utilisation</a>
                        </p>
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email de confirmation de paiement Stripe envoyé avec succès:', {
            messageId: info.messageId,
            to: orderData.shipping_info.email
        });
        return info;
    } catch (error) {
        console.error('Erreur lors de l\'envoi de l\'email de confirmation de paiement Stripe:', {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        throw error;
    }
};

module.exports = {
    sendOrderConfirmation,
    sendStripePaymentConfirmation
}; 