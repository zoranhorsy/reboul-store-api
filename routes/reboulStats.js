const express = require('express')
const router = express.Router()
const { ReboulProductController } = require('../controllers/reboulProductController')

// GET statistiques des produits Reboul
router.get('/stats', async (req, res, next) => {
  try {
    console.log('--- REQUÊTE GET /api/reboul/stats REÇUE ---')
    
    const stats = await ReboulProductController.getReboulStats()
    
    console.log('Statistiques Reboul calculées:', stats)
    res.json(stats)
  } catch (error) {
    console.error('Erreur lors du calcul des statistiques Reboul:', error)
    next(error)
  }
})

module.exports = router 