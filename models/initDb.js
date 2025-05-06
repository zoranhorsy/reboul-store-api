const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function initializeDatabase() {
  console.log('Initialisation de la base de données...');
  
  try {
    // Lire les fichiers SQL dans l'ordre correct
    const tableQueries = fs.readFileSync(path.join(__dirname, 'tables.sql'), 'utf8');
    const apiCacheQuery = fs.readFileSync(path.join(__dirname, 'api_cache.sql'), 'utf8');
    const indexQueries = fs.readFileSync(path.join(__dirname, 'indexes.sql'), 'utf8');
    const seedQueries = fs.readFileSync(path.join(__dirname, 'seeds.sql'), 'utf8');
    
    // Créer les tables
    console.log('Création des tables...');
    await pool.query(tableQueries);
    
    // Créer la table de cache API
    console.log('Création de la table de cache API...');
    await pool.query(apiCacheQuery);
    
    // Ajouter les index pour l'optimisation
    console.log('Création des index pour optimiser les requêtes...');
    await pool.query(indexQueries);
    
    // Ajouter les données initiales
    console.log('Insertion des données initiales...');
    await pool.query(seedQueries);
    
    console.log('Initialisation de la base de données terminée avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error);
    throw error;
  }
}

module.exports = { initializeDatabase }; 