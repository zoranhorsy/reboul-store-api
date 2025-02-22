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
    // Configuration du pool
    max: 20, // maximum de connexions dans le pool
    idleTimeoutMillis: 30000, // temps maximum d'inactivité d'une connexion
    connectionTimeoutMillis: 10000, // temps maximum pour établir une connexion
};

// Fonction pour tenter une connexion avec retry
const connectWithRetry = async (retries = 5, delay = 5000) => {
    const pool = new Pool(config);

    for (let i = 0; i < retries; i++) {
        try {
            await pool.query('SELECT NOW()');
            console.log('Connexion à la base de données réussie');
            return pool;
        } catch (err) {
            console.error(`Tentative de connexion ${i + 1}/${retries} échouée:`, err.message);
            if (i === retries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Variable globale pour le pool
let pool = null;

// Initialisation du pool avec retry
const initPool = async () => {
    try {
        pool = await connectWithRetry();
        
        pool.on('error', (err) => {
            console.error('Erreur inattendue du pool de connexion:', err);
            // Tentative de reconnexion en cas d'erreur
            setTimeout(initPool, 5000);
        });
    } catch (err) {
        console.error('Erreur fatale lors de l\'initialisation du pool:', err);
        process.exit(1);
    }
};

// Initialisation immédiate
initPool();

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

