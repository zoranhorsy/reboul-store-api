const { Pool } = require('pg');
require('dotenv').config();

console.log('Initialisation de la connexion à la base de données...');
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:wuRWzXkTzKjXDFradojRvRtTDiSuOXos@nozomi.proxy.rlwy.net:14067/railway",
    // Options de connexion
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20,
    // Désactiver SSL si non supporté
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

// Test de connexion initial
pool.query('SELECT NOW()', (err, result) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err);
        console.error('Détails de l\'erreur:', {
            code: err.code,
            message: err.message,
            stack: err.stack
        });
    } else {
        console.log('Connexion à la base de données réussie');
        console.log('Timestamp de la base:', result.rows[0].now);
        
        // Test supplémentaire pour vérifier l'accès aux tables
        pool.query('SELECT COUNT(*) FROM products', (err, result) => {
            if (err) {
                console.error('Erreur lors de l\'accès à la table products:', err);
            } else {
                console.log('Nombre de produits dans la base:', result.rows[0].count);
            }
        });
    }
});

// Gestion des erreurs de connexion
pool.on('error', (err) => {
    console.error('Erreur inattendue du pool de connexion:', err);
    console.error('Détails:', {
        code: err.code,
        message: err.message,
        stack: err.stack
    });
});

module.exports = {
    query: (text, params) => {
        console.log('Exécution de la requête:', text);
        console.log('Paramètres:', params);
        return pool.query(text, params);
    },
    pool
};
