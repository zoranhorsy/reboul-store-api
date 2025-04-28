const request = require('supertest');
const app = require('../server');
const { pool } = require('../db');
const { uploadToCloudinary } = require('../utils/cloudinary');

jest.mock('../utils/cloudinary', () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn()
}));

describe('The Corner Products API', () => {
  let testProduct;
  let authToken;

  beforeAll(async () => {
    // Connexion admin pour les tests
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: process.env.TEST_ADMIN_EMAIL,
        password: process.env.TEST_ADMIN_PASSWORD
      });
    authToken = loginResponse.body.token;
  });

  beforeEach(async () => {
    // Créer un produit de test
    const { rows } = await pool.query(`
      INSERT INTO corner_products (
        name, description, price, category_id, brand_id,
        variants, active, new
      ) VALUES (
        'Test Product', 'Test Description', 99.99, 1, 1,
        '[{"color": "Noir", "size": "M", "stock": 10}]', true, false
      ) RETURNING *
    `);
    testProduct = rows[0];
  });

  afterEach(async () => {
    // Nettoyer les données de test
    await pool.query('DELETE FROM corner_products WHERE name LIKE \'Test%\'');
  });

  describe('GET /api/corner-products', () => {
    it('should return a list of products', async () => {
      const response = await request(app)
        .get('/api/corner-products')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter products by category', async () => {
      const response = await request(app)
        .get('/api/corner-products')
        .query({ category_id: 1 })
        .expect(200);

      expect(response.body.data.every(p => p.category_id === 1)).toBe(true);
    });

    it('should filter products by price range', async () => {
      const response = await request(app)
        .get('/api/corner-products')
        .query({ minPrice: 50, maxPrice: 150 })
        .expect(200);

      expect(response.body.data.every(p => p.price >= 50 && p.price <= 150)).toBe(true);
    });

    it('should filter in-stock products', async () => {
      const response = await request(app)
        .get('/api/corner-products')
        .query({ inStock: 'true' })
        .expect(200);

      expect(response.body.data.every(p => {
        const variants = JSON.parse(p.variants || '[]');
        return variants.some(v => v.stock > 0);
      })).toBe(true);
    });
  });

  describe('GET /api/corner-products/:id', () => {
    it('should return a single product', async () => {
      const response = await request(app)
        .get(`/api/corner-products/${testProduct.id}`)
        .expect(200);

      expect(response.body.id).toBe(testProduct.id);
      expect(response.body.name).toBe(testProduct.name);
    });

    it('should return 404 for non-existent product', async () => {
      await request(app)
        .get('/api/corner-products/99999')
        .expect(404);
    });
  });

  describe('POST /api/corner-products', () => {
    it('should create a new product', async () => {
      const newProduct = {
        name: 'Test New Product',
        description: 'Test Description',
        price: 129.99,
        category_id: 1,
        brand_id: 1,
        variants: [
          { color: 'Noir', size: 'M', stock: 5 },
          { color: 'Blanc', size: 'L', stock: 3 }
        ]
      };

      const response = await request(app)
        .post('/api/corner-products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newProduct)
        .expect(201);

      expect(response.body.name).toBe(newProduct.name);
      expect(response.body.price).toBe(newProduct.price.toString());
    });

    it('should validate required fields', async () => {
      const invalidProduct = {
        description: 'Test Description'
      };

      await request(app)
        .post('/api/corner-products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidProduct)
        .expect(400);
    });
  });

  describe('PUT /api/corner-products/:id', () => {
    it('should update an existing product', async () => {
      const updates = {
        name: 'Updated Test Product',
        price: 149.99
      };

      const response = await request(app)
        .put(`/api/corner-products/${testProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe(updates.name);
      expect(response.body.price).toBe(updates.price.toString());
    });
  });

  describe('PATCH /api/corner-products/:id/stock', () => {
    it('should update variant stock', async () => {
      const stockUpdate = {
        color: 'Noir',
        size: 'M',
        quantity: 15
      };

      const response = await request(app)
        .patch(`/api/corner-products/${testProduct.id}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(stockUpdate)
        .expect(200);

      const variants = JSON.parse(response.body.variants);
      const updatedVariant = variants.find(
        v => v.color === stockUpdate.color && v.size === stockUpdate.size
      );
      expect(updatedVariant.stock).toBe(stockUpdate.quantity);
    });

    it('should validate stock quantity', async () => {
      const invalidUpdate = {
        color: 'Noir',
        size: 'M',
        quantity: -1
      };

      await request(app)
        .patch(`/api/corner-products/${testProduct.id}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidUpdate)
        .expect(400);
    });
  });

  describe('DELETE /api/corner-products/:id', () => {
    it('should soft delete product with existing orders', async () => {
      // Créer une commande pour le produit
      await pool.query(`
        INSERT INTO order_items (order_id, corner_product_id, quantity, price)
        VALUES (1, $1, 1, 99.99)
      `, [testProduct.id]);

      const response = await request(app)
        .delete(`/api/corner-products/${testProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.type).toBe('soft_delete');
      expect(response.body.product.active).toBe(false);
    });

    it('should hard delete product without orders', async () => {
      const response = await request(app)
        .delete(`/api/corner-products/${testProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.type).toBe('hard_delete');
      
      // Vérifier que le produit n'existe plus
      const { rows } = await pool.query(
        'SELECT * FROM corner_products WHERE id = $1',
        [testProduct.id]
      );
      expect(rows.length).toBe(0);
    });
  });
}); 