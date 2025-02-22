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
    }
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

