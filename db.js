const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:wuRWzXkTzKjXDFradojRvRtTDiSuOXos@nozomi.proxy.rlwy.net:14067/railway",
    ssl: {
        rejectUnauthorized: false
    },
    // Options de connexion
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 20
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

