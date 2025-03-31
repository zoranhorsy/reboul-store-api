const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const { authenticateToken } = require('../middleware/auth');

// TODO: Implement proper authentication middleware
router.use((req, res, next) => {
  console.log('Authentication middleware placeholder');
  next();
});

// Brand routes
router.get('/', brandController.getAllBrands);
router.post('/', brandController.createBrand);
router.put('/:id', brandController.updateBrand);
router.delete('/:id', brandController.deleteBrand);

module.exports = router;