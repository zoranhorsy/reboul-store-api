const { Pool } = require('pg');
require('dotenv').config();

console.log('Initialisation de la connexion à PostgreSQL local...');

const pool = new Pool({
    user: process.env.USER || process.env.LOGNAME, // Utilise le nom d'utilisateur système
    host: 'localhost',
    database: 'reboul_store',
    port: 5432,
    // Pas de mot de passe pour la connexion locale par défaut
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20,
    ssl: false // Pas de SSL pour le local
});

// Test de connexion initial
pool.query('SELECT NOW()', (err, result) => {
    if (err) {
        console.error('Erreur de connexion à PostgreSQL local:', err);
        console.error('Détails de l\'erreur:', {
            code: err.code,
            message: err.message,
            stack: err.stack
        });
    } else {
        console.log('Connexion à PostgreSQL local réussie');
        console.log('Timestamp de la base:', result.rows[0].now);
        
        // Test supplémentaire pour vérifier l'accès aux tables
        pool.query('SELECT COUNT(*) FROM products', (err, result) => {
            if (err) {
                console.log('Tables pas encore créées (normal pour la première fois)');
            } else {
                console.log('Nombre de produits dans la base:', result.rows[0].count);
            }
        });
    }
});

// Gestion des erreurs de connexion
pool.on('error', (err) => {
    console.error('Erreur inattendue du pool de connexion:', err);
});

module.exports = {
    query: (text, params) => {
        console.log('Exécution de la requête:', text);
        console.log('Paramètres:', params);
        return pool.query(text, params);
    },
    pool
};
