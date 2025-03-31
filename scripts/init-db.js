const fs = require('fs');
const path = require('path');
const pool = require('../db');

async function initDatabase() {
    try {
        console.log('Initialisation de la base de données...');
        
        // Lire le fichier SQL
        const sqlPath = path.join(__dirname, '..', 'init-db.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Exécuter les commandes SQL
        await pool.query(sql);
        
        console.log('Base de données initialisée avec succès !');
        
        // Créer un utilisateur admin par défaut
        const bcrypt = require('bcrypt');
        const adminPassword = await bcrypt.hash('admin123', 10);
        
        await pool.query(
            'INSERT INTO users (username, email, password_hash, is_admin) VALUES ($1, $2, $3, $4)',
            ['admin', 'admin@example.com', adminPassword, true]
        );
        
        console.log('Utilisateur admin créé avec succès !');
        console.log('Email: admin@example.com');
        console.log('Mot de passe: admin123');
        
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de la base de données:', error);
    } finally {
        await pool.end();
    }
}

initDatabase(); 