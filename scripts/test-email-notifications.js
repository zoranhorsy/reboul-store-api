const { sendOrderStatusNotification, sendTrackingNotification } = require('../config/mailer');
require('dotenv').config();

/**
 * Script de test pour vérifier le système d'envoi d'emails de notification
 * Usage: node scripts/test-email-notifications.js
 */

// Données de test pour une commande fictive
const mockOrder = {
    id: 12345,
    order_number: 'ORD-TEST-123456789',
    user_id: 1,
    total_amount: 89.99,
    status: 'processing',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    shipping_info: {
        firstName: 'Test',
        lastName: 'User',
        email: process.env.TEST_EMAIL || 'test@reboulstore.com',
        address: '123 Rue de Test',
        postalCode: '75001',
        city: 'Paris',
        country: 'France'
    },
    items: [
        {
            product_id: 1,
            quantity: 2,
            price: 44.99,
            variant: { size: 'L', color: 'Noir' }
        }
    ]
};

async function testEmailNotifications() {
    console.log('🧪 Test des notifications email pour Reboul Store');
    console.log('=====================================================');
    
    if (!process.env.TEST_EMAIL) {
        console.log('⚠️  Variable d\'environnement TEST_EMAIL non définie');
        console.log('   Utilisation de l\'email par défaut: test@reboulstore.com');
        console.log('   Pour tester avec votre email, ajoutez TEST_EMAIL=votre@email.com dans votre .env');
        console.log('');
    }

    const statuses = ['processing', 'shipped', 'delivered', 'cancelled'];
    
    try {
        for (const status of statuses) {
            console.log(`📧 Test de l'email pour le statut: ${status}`);
            
            const orderWithStatus = {
                ...mockOrder,
                status: status,
                tracking_number: status === 'shipped' ? 'TEST-TRACK-123456789' : null
            };
            
            try {
                await sendOrderStatusNotification(orderWithStatus, 'pending', status);
                console.log(`   ✅ Email envoyé avec succès pour le statut: ${status}`);
            } catch (error) {
                console.log(`   ❌ Erreur lors de l'envoi de l'email pour le statut: ${status}`);
                console.log(`   Détails: ${error.message}`);
            }
            
            // Petit délai entre les emails
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Test spécifique pour l'email de suivi
        console.log('\n📦 Test de l\'email de suivi (tracking)');
        
        const orderWithTracking = {
            ...mockOrder,
            status: 'shipped',
            tracking_number: 'TEST-TRACK-123456789'
        };
        
        try {
            await sendTrackingNotification(orderWithTracking, 'TEST-TRACK-123456789', 'Colissimo');
            console.log('   ✅ Email de suivi envoyé avec succès');
        } catch (error) {
            console.log('   ❌ Erreur lors de l\'envoi de l\'email de suivi');
            console.log(`   Détails: ${error.message}`);
        }
        
        console.log('\n🎉 Test terminé !');
        console.log('Vérifiez votre boîte mail pour voir les emails de test.');
        
    } catch (error) {
        console.error('❌ Erreur générale lors du test:', error);
    }
}

async function testSMTPConfiguration() {
    console.log('🔧 Test de la configuration SMTP');
    console.log('=================================');
    
    const requiredEnvVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.log('❌ Variables d\'environnement manquantes:');
        missingVars.forEach(varName => console.log(`   - ${varName}`));
        console.log('\nVeuillez configurer ces variables dans votre fichier .env');
        return false;
    }
    
    console.log('✅ Toutes les variables d\'environnement SMTP sont configurées');
    console.log(`   Host: ${process.env.SMTP_HOST}`);
    console.log(`   Port: ${process.env.SMTP_PORT || '587'}`);
    console.log(`   User: ${process.env.SMTP_USER}`);
    console.log(`   Secure: ${process.env.SMTP_SECURE || 'false'}`);
    
    return true;
}

// Fonction principale
async function main() {
    console.log('🚀 Démarrage du test des notifications email Reboul Store\n');
    
    // Vérifier la configuration SMTP
    const smtpConfigValid = await testSMTPConfiguration();
    
    if (!smtpConfigValid) {
        console.log('\n❌ Configuration SMTP invalide, arrêt du test');
        process.exit(1);
    }
    
    console.log('\n');
    
    // Tester les notifications email
    await testEmailNotifications();
    
    console.log('\n📝 Notes importantes:');
    console.log('- Les emails de test sont envoyés à l\'adresse configurée dans TEST_EMAIL');
    console.log('- En production, les emails seront envoyés aux vrais clients');
    console.log('- Vérifiez également votre dossier spam/courrier indésirable');
    console.log('\n✨ Test terminé avec succès !');
    
    process.exit(0);
}

// Gestion des arguments de ligne de commande
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/test-email-notifications.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --help, -h     Afficher cette aide');
    console.log('');
    console.log('Variables d\'environnement:');
    console.log('  TEST_EMAIL     Email de destination pour les tests (optionnel)');
    console.log('  SMTP_HOST      Serveur SMTP (requis)');
    console.log('  SMTP_USER      Nom d\'utilisateur SMTP (requis)');
    console.log('  SMTP_PASS      Mot de passe SMTP (requis)');
    console.log('  SMTP_PORT      Port SMTP (optionnel, défaut: 587)');
    console.log('  SMTP_SECURE    Utiliser TLS (optionnel, défaut: false)');
    process.exit(0);
}

// Lancer le test
main().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
}); 