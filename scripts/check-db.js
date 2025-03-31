const pool = require('../db');
const bcrypt = require('bcrypt');

async function checkDatabase() {
    try {
        // Test de connexion
        const connectionTest = await pool.query('SELECT NOW()');
        console.log('Connexion à la base de données réussie:', connectionTest.rows[0].now);

        // Vérification de la table settings
        const settingsTableExists = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'settings'
            );
        `);

        if (!settingsTableExists.rows[0].exists) {
            console.log('Création de la table settings...');
            await pool.query(`
                CREATE TABLE settings (
                    id SERIAL PRIMARY KEY,
                    site_name VARCHAR(255) NOT NULL,
                    site_description TEXT,
                    contact_email VARCHAR(255),
                    enable_registration BOOLEAN DEFAULT true,
                    enable_checkout BOOLEAN DEFAULT true,
                    maintenance_mode BOOLEAN DEFAULT false,
                    currency VARCHAR(10) DEFAULT 'EUR',
                    tax_rate DECIMAL(5,2) DEFAULT 20.00,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                INSERT INTO settings (
                    site_name, site_description, contact_email, 
                    enable_registration, enable_checkout, maintenance_mode, 
                    currency, tax_rate
                ) VALUES (
                    'Mon E-commerce', 'Description du site', 'contact@example.com',
                    true, true, false,
                    'EUR', 20.00
                );
            `);
            console.log('Table settings créée avec succès');
        }

        // Vérification de l'utilisateur
        const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', ['zoran@reboul.com']);
        if (rows.length === 0) {
            console.log('Aucun utilisateur trouvé avec cet email');
        } else {
            const user = rows[0];
            console.log('Utilisateur trouvé:', {
                id: user.id,
                email: user.email,
                username: user.username,
                is_admin: user.is_admin,
                password_hash_length: user.password_hash.length
            });

            // Test de mot de passe
            const testPassword = 'nouveauMotDePasse123'; // Remplacez par le vrai mot de passe si connu
            const passwordValid = await bcrypt.compare(testPassword, user.password_hash);
            console.log('Test de mot de passe:', testPassword, 'Résultat:', passwordValid ? 'Valide' : 'Invalide');
        }
    } catch (error) {
        console.error('Erreur lors de la vérification de la base de données:', error);
    } finally {
        await pool.end();
    }
}

checkDatabase();

