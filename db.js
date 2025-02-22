const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('Erreur inattendue du pool de connexion', err);
});

// Ne pas faire la requête de test en environnement de test
if (process.env.NODE_ENV !== 'test') {
    // Test de connexion
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('Erreur de connexion à la base de données:', err);
        } else {
            console.log('Connexion à la base de données réussie');
        }
    });
}

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};

