/**
 * Script de configuration de la tâche cron pour la synchronisation Stripe
 * 
 * Ce script configure une tâche cron qui exécute le script de synchronisation 
 * des produits avec Stripe selon une planification régulière.
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const SCRIPT_PATH = path.resolve(__dirname, 'stripe-product-sync.js');
const CRON_SCHEDULE = '0 2 * * *'; // Tous les jours à 2h du matin
const LOG_PATH = path.resolve(__dirname, '../logs/stripe-sync-cron.log');

// Vérifier que le script de synchronisation existe
if (!fs.existsSync(SCRIPT_PATH)) {
  console.error(`Erreur: Le script de synchronisation n'existe pas à l'emplacement: ${SCRIPT_PATH}`);
  process.exit(1);
}

// Fonction pour ajouter la tâche cron
function setupCronJob() {
  // Créer la commande crontab
  const cronCommand = `${CRON_SCHEDULE} /usr/bin/node ${SCRIPT_PATH} >> ${LOG_PATH} 2>&1`;
  
  // Lire le crontab actuel
  exec('crontab -l', (error, stdout, stderr) => {
    let currentCrontab = '';
    
    // Gérer les erreurs
    if (error && error.code !== 1) { // Le code 1 est normal si aucun crontab n'existe
      console.error(`Erreur lors de la lecture du crontab: ${error.message}`);
      return;
    }
    
    // Si un crontab existe, le récupérer
    if (!error) {
      currentCrontab = stdout;
    }
    
    // Vérifier si notre tâche existe déjà
    if (currentCrontab.includes(SCRIPT_PATH)) {
      console.log('La tâche cron de synchronisation Stripe existe déjà.');
      return;
    }
    
    // Ajouter notre nouvelle tâche
    const newCrontab = currentCrontab + `\n# Synchronisation des produits Reboul avec Stripe\n${cronCommand}\n`;
    
    // Écrire le nouveau crontab
    const tempFile = path.resolve(__dirname, 'temp_crontab');
    fs.writeFileSync(tempFile, newCrontab);
    
    exec(`crontab ${tempFile}`, (error, stdout, stderr) => {
      // Supprimer le fichier temporaire
      fs.unlinkSync(tempFile);
      
      if (error) {
        console.error(`Erreur lors de la configuration du crontab: ${error.message}`);
        return;
      }
      
      console.log('Tâche cron de synchronisation Stripe configurée avec succès!');
      console.log(`Planification: ${CRON_SCHEDULE} (tous les jours à 2h du matin)`);
      console.log(`Logs: ${LOG_PATH}`);
    });
  });
}

// Exécuter la configuration
setupCronJob(); 