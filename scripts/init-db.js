#!/usr/bin/env node

/**
 * Script d'initialisation/mise à jour de la base de données
 * Exécute les scripts SQL pour créer/mettre à jour les tables, index et cache
 */

const { initializeDatabase } = require('../models/initDb');
const { pool } = require('../config/db');

async function runDatabaseInit() {
  try {
    console.log('Démarrage de l\'initialisation de la base de données...');
    await initializeDatabase();
    console.log('Base de données initialisée avec succès');
    
    // Nettoyage du cache API existant
    console.log('Nettoyage du cache API existant...');
    await pool.query('DELETE FROM api_cache WHERE 1=1');
    console.log('Cache API nettoyé');
    
    console.log('Configuration de la base de données terminée');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la base de données:', error);
    process.exit(1);
  } finally {
    // Fermer la connexion à la base de données
    await pool.end();
  }
}

// Exécuter l'initialisation
runDatabaseInit(); 