const { Pool } = require('pg');
require('dotenv').config();

// Force IPv4
const types = require('pg').types;
types.setTypeParser(20, function(val) {
    return parseInt(val, 10);
});

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

