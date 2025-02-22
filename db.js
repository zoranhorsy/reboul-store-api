const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    password: 'DTDgjwuEWk0o3Iis',
    host: 'db.imshohofssmnexditciw.supabase.co',
    port: 5432,
    database: 'postgres',
    ssl: {
        rejectUnauthorized: false
    },
    // Options supplémentaires pour améliorer la connexion
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20,
    application_name: 'reboul-store-api',
    keepalive: true,
    keepaliveInitialDelayMillis: 10000
});

// Test de connexion initial
pool.query('SELECT NOW()', (err) => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err);
    } else {
        console.log('Connexion à la base de données réussie');
    }
});

// Gestion des erreurs de connexion
pool.on('error', (err) => {
    console.error('Erreur inattendue du pool de connexion:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};

