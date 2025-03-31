const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Connexion à la base de données
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Nécessaire pour les connexions à Heroku/Railway
    }
});

async function runMigration() {
    // Chemin vers le fichier de migration
    const migrationPath = path.join(__dirname, 'migrations', 'add_reset_password_fields.sql');
    
    // Lecture du fichier SQL
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    let client;
    try {
        // Connexion à la base de données
        client = await pool.connect();
        console.log('Connexion à la base de données établie');
        
        // Début de la transaction
        await client.query('BEGIN');
        
        // Exécution du script SQL
        console.log('Exécution de la migration...');
        const result = await client.query(sql);
        console.log('Migration exécutée avec succès');
        
        // Affichage des résultats
        if (result.length > 0 && result[result.length - 1].rows.length > 0) {
            console.log(result[result.length - 1].rows[0].message);
        }
        
        // Validation de la transaction
        await client.query('COMMIT');
    } catch (error) {
        // En cas d'erreur, annulation de la transaction
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Erreur lors de l\'exécution de la migration:', error);
        process.exit(1);
    } finally {
        // Libération de la connexion
        if (client) {
            client.release();
        }
        pool.end();
        console.log('Connexion à la base de données fermée');
    }
}

// Exécution de la migration
runMigration(); 