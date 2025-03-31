const request = require('supertest');
const { setupTestApp } = require('../testSetup');
const { ProductController } = require('../../controllers/productController');
const { AppError } = require('../../middleware/errorHandler');

// Mocks
jest.mock('../../controllers/productController');
jest.mock('../../middleware/auth', () => (req, res, next) => next());
jest.mock('../../middleware/upload', () => (req, res, next) => next());

// Setup
const app = setupTestApp();
app.use('/api/products', require('../../routes/products'));

describe('Routes des produits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /products', () => {
    it('devrait retourner une liste paginée de produits', async () => {
      const res = await request(app)
        .get('/api/products')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(ProductController.getAllProducts).toHaveBeenCalled();
    });
  });

  describe('GET /products/:id', () => {
    it('devrait retourner un produit', async () => {
      const res = await request(app)
        .get('/api/products/1')
        .expect(200);

      expect(res.body.id).toBe(1);
    });

    it('devrait retourner 404 pour un produit inexistant', async () => {
      const res = await request(app)
        .get('/api/products/999')
        .expect(404);
      
      expect(res.body).toEqual({
        status: 'error',
        message: 'Produit non trouvé'
      });
    });
  });
}); 