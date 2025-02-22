const { Pool } = require('pg');
require('dotenv').config();

// Configuration de la connexion
const config = {
    user: 'postgres',
    password: 'DTDgjwuEWk0o3Iis',
    host: 'db.imshohofssmnexditciw.supabase.co',
    port: 5432,
    database: 'postgres',
    ssl: {
        rejectUnauthorized: false
    },
    // Options supplémentaires pour la résolution DNS
    options: '-c search_path=public',
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
};

// Création du pool avec retry
const createPool = async () => {
    const pool = new Pool(config);
    
    try {
        // Test de connexion
        await pool.query('SELECT NOW()');
        console.log('Connexion à la base de données réussie');
        return pool;
    } catch (err) {
        console.error('Erreur de connexion initiale:', err);
        
        // Tentative avec l'adresse IP directe de Supabase
        try {
            const altConfig = {
                ...config,
                host: '146.190.28.188' // Adresse IP de Supabase
            };
            const altPool = new Pool(altConfig);
            await altPool.query('SELECT NOW()');
            console.log('Connexion à la base de données réussie via IP');
            return altPool;
        } catch (err2) {
            console.error('Erreur de connexion alternative:', err2);
            throw err2;
        }
    }
};

// Création du pool
let pool;
createPool()
    .then(p => {
        pool = p;
        pool.on('error', err => {
            console.error('Erreur inattendue du pool de connexion:', err);
        });
    })
    .catch(err => {
        console.error('Erreur fatale de connexion:', err);
        process.exit(1);
    });

// Export avec gestion d'erreur
module.exports = {
    query: async (text, params) => {
        if (!pool) {
            throw new Error('Pool non initialisé');
        }
        try {
            return await pool.query(text, params);
        } catch (err) {
            console.error('Erreur de requête:', err);
            throw err;
        }
    },
    pool: () => pool
};

