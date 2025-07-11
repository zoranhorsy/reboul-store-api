const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Test simple de la configuration SMTP
 */

async function testSMTPSimple() {
    console.log('🧪 Test SMTP simple pour Reboul Store');
    console.log('=====================================');
    
    // Vérifier les variables d'environnement
    const requiredVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.log('❌ Variables d\'environnement manquantes:');
        missingVars.forEach(varName => console.log(`   - ${varName}`));
        process.exit(1);
    }
    
    console.log('✅ Variables SMTP configurées');
    console.log(`   Host: ${process.env.SMTP_HOST}`);
    console.log(`   Port: ${process.env.SMTP_PORT || '587'}`);
    console.log(`   User: ${process.env.SMTP_USER}`);
    
    // Créer le transporteur
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    
    try {
        // Test de connexion
        console.log('\n🔌 Test de connexion SMTP...');
        await transporter.verify();
        console.log('✅ Connexion SMTP réussie !');
        
        // Envoi d'un email de test simple
        console.log('\n📧 Envoi d\'un email de test...');
        const info = await transporter.sendMail({
            from: `"Reboul Store Test" <${process.env.SMTP_USER}>`,
            to: process.env.TEST_EMAIL || process.env.SMTP_USER,
            subject: 'Test SMTP Reboul Store - ' + new Date().toLocaleString(),
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #4a4a4a;">🎉 Test SMTP réussi !</h1>
                    <p>Ce test confirme que la configuration SMTP de Reboul Store fonctionne correctement.</p>
                    <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h3>Détails du test :</h3>
                        <p><strong>Date :</strong> ${new Date().toLocaleString()}</p>
                        <p><strong>Serveur SMTP :</strong> ${process.env.SMTP_HOST}</p>
                        <p><strong>Environnement :</strong> ${process.env.NODE_ENV || 'development'}</p>
                    </div>
                    <p style="color: #666;">L'équipe Reboul Store</p>
                </div>
            `
        });
        
        console.log('✅ Email de test envoyé avec succès !');
        console.log(`   Message ID: ${info.messageId}`);
        console.log(`   Destinataire: ${process.env.TEST_EMAIL || process.env.SMTP_USER}`);
        
        console.log('\n🎉 Test SMTP terminé avec succès !');
        console.log('Vous pouvez maintenant réactiver le système d\'emails automatiques.');
        
    } catch (error) {
        console.error('❌ Erreur lors du test SMTP:', error.message);
        if (error.code) {
            console.error(`   Code d'erreur: ${error.code}`);
        }
        if (error.command) {
            console.error(`   Commande: ${error.command}`);
        }
        process.exit(1);
    }
}

// Gestion des arguments
if (process.argv.includes('--help')) {
    console.log('Usage: node scripts/test-email-simple.js');
    console.log('');
    console.log('Variables d\'environnement requises:');
    console.log('  SMTP_HOST      Serveur SMTP');
    console.log('  SMTP_USER      Email utilisateur');
    console.log('  SMTP_PASS      Mot de passe');
    console.log('  SMTP_PORT      Port (optionnel, défaut: 587)');
    console.log('  SMTP_SECURE    SSL/TLS (optionnel, défaut: false)');
    console.log('  TEST_EMAIL     Email de destination (optionnel)');
    process.exit(0);
}

// Lancer le test
testSMTPSimple().catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
}); 