const nodemailer = require('nodemailer');
require('dotenv').config();

// Vérifier la présence des variables d'environnement nécessaires
if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ Configuration SMTP incomplète.');
    console.log('Veuillez vérifier les variables d\'environnement :');
    console.log('- SMTP_HOST:', process.env.SMTP_HOST || 'Non défini');
    console.log('- SMTP_PORT:', process.env.SMTP_PORT || 'Non défini');
    console.log('- SMTP_USER:', process.env.SMTP_USER || 'Non défini');
    console.log('- SMTP_PASS:', process.env.SMTP_PASS ? 'Défini (masqué)' : 'Non défini ❌');
    process.exit(1);
}

console.log('=== Configuration SMTP ===');
console.log('Host:', process.env.SMTP_HOST);
console.log('Port:', process.env.SMTP_PORT);
console.log('Secure:', process.env.SMTP_SECURE === 'true' ? 'Oui' : 'Non');
console.log('User:', process.env.SMTP_USER);
console.log('Pass:', process.env.SMTP_PASS ? '[Masqué]' : 'Non défini ❌');

// Création du transporteur
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Fonction pour envoyer un email de test
async function sendTestEmail() {
    console.log('\n=== Envoi d\'un email de test ===');
    
    // Email de destination
    const testEmail = process.argv[2] || process.env.SMTP_USER;
    console.log('Email de destination:', testEmail);
    
    try {
        // Vérifier la configuration
        console.log('Vérification de la configuration SMTP...');
        await transporter.verify();
        console.log('✅ Configuration SMTP valide');
        
        // Préparer l'email
        const mailOptions = {
            from: `"Test Reboul Store" <${process.env.SMTP_USER}>`,
            to: testEmail,
            subject: 'Test de configuration - Reboul Store',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                    <h1 style="color: #333; text-align: center;">Test d'email réussi !</h1>
                    <p>Bonjour,</p>
                    <p>Si vous recevez cet email, cela signifie que la configuration SMTP de Reboul Store fonctionne correctement.</p>
                    <p>Cet email a été envoyé le ${new Date().toLocaleString('fr-FR')}.</p>
                    <p>Vous pouvez maintenant utiliser la fonctionnalité de réinitialisation de mot de passe.</p>
                    
                    <p style="margin-top: 30px;">Cordialement,<br>L'équipe Reboul Store</p>
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #888;">
                        <p>Cet email est un test automatique, merci de ne pas y répondre.</p>
                    </div>
                </div>
            `
        };
        
        // Envoyer l'email
        console.log('Envoi de l\'email...');
        const info = await transporter.sendMail(mailOptions);
        
        console.log('✅ Email envoyé avec succès !');
        console.log('ID du message:', info.messageId);
        console.log('URL de prévisualisation:', nodemailer.getTestMessageUrl(info));
        
    } catch (error) {
        console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
        
        // Détails supplémentaires sur l'erreur
        if (error.code === 'EAUTH') {
            console.log('\n⚠️ Problème d\'authentification. Vérifiez les identifiants SMTP.');
            console.log('Si vous utilisez Gmail, assurez-vous d\'avoir :');
            console.log('1. Activé l\'option "Accès moins sécurisé aux applications" ou');
            console.log('2. Créé un mot de passe d\'application spécifique');
        } else if (error.code === 'ESOCKET') {
            console.log('\n⚠️ Problème de connexion au serveur SMTP. Vérifiez le host et le port.');
        }
    }
}

// Exécuter la fonction
sendTestEmail(); 