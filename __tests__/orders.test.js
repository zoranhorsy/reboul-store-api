const request = require('supertest');
const { app } = require('../server');
const pool = require('../db').pool;
const jwt = require('jsonwebtoken');

jest.setTimeout(30000); // Augmenter le timeout à 30 secondes

describe('Order Management & Stock Control', () => {
    let testProduct;
    let testUser;
    let userToken;
    let testCategory;

    beforeAll(async () => {
        // Créer un utilisateur de test
        const userResult = await pool.query(
            'INSERT INTO users (username, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, email, is_admin',
            ['testuser', 'test@example.com', 'hashedpassword', true]
        );
        testUser = userResult.rows[0];

        // Créer un token pour l'utilisateur
        userToken = jwt.sign(
            { id: testUser.id, isAdmin: testUser.is_admin },
            process.env.JWT_SECRET
        );

        // Créer une catégorie de test
        const categoryResult = await pool.query(
            'INSERT INTO categories (name) VALUES ($1) RETURNING id',
            ['Test Category']
        );
        testCategory = categoryResult.rows[0];

        // Créer un produit de test avec variants
        const productResult = await pool.query(
            `INSERT INTO products (
                name, description, price, category_id, variants, store_type
            ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                'Test Product',
                'Test Description',
                99.99,
                testCategory.id,
                JSON.stringify([
                    { color: "Noir", size: "M", stock: 3 },
                    { color: "Noir", size: "L", stock: 2 }
                ]),
                'adult'
            ]
        );
        testProduct = productResult.rows[0];
    });

    afterAll(async () => {
        try {
            // Nettoyer la base de données
            await pool.query('DELETE FROM order_items');
            await pool.query('DELETE FROM orders');
            await pool.query('DELETE FROM products WHERE id = $1', [testProduct.id]);
            await pool.query('DELETE FROM categories WHERE id = $1', [testCategory.id]);
            await pool.query('DELETE FROM users WHERE id = $1', [testUser.id]);
        } finally {
            // Fermer toutes les connexions
            await pool.end();
        }
    });

    describe('Stock Management with Variants', () => {
        it('should successfully create an order and decrease variant stock', async () => {
            const orderData = {
                items: [{
                    product_id: testProduct.id,
                    quantity: 2,
                    variant: { size: "M", color: "Noir" }
                }],
                shipping_info: {
                    firstName: "Test",
                    lastName: "User",
                    email: "test@example.com",
                    phone: "0123456789",
                    address: "123 Test St",
                    city: "Test City",
                    postalCode: "12345",
                    country: "France"
                }
            };

            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send(orderData);

            expect(response.status).toBe(201);
            expect(response.body.items).toBeDefined();

            // Vérifier le stock mis à jour
            const updatedProduct = await pool.query(
                'SELECT variants FROM products WHERE id = $1',
                [testProduct.id]
            );
            const variant = updatedProduct.rows[0].variants.find(
                v => v.size === "M" && v.color === "Noir"
            );
            expect(variant.stock).toBe(1); // 3 - 2 = 1
        });

        it('should fail when ordering more than available stock', async () => {
            const orderData = {
                items: [{
                    product_id: testProduct.id,
                    quantity: 5, // Plus que le stock disponible
                    variant: { size: "M", color: "Noir" }
                }],
                shipping_info: {
                    firstName: "Test",
                    lastName: "User",
                    email: "test@example.com",
                    phone: "0123456789",
                    address: "123 Test St",
                    city: "Test City",
                    postalCode: "12345",
                    country: "France"
                }
            };

            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send(orderData);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Stock insuffisant');
        });

        it('should fail when ordering non-existent variant', async () => {
            const orderData = {
                items: [{
                    product_id: testProduct.id,
                    quantity: 1,
                    variant: { size: "XL", color: "Rouge" } // Variant qui n'existe pas
                }],
                shipping_info: {
                    firstName: "Test",
                    lastName: "User",
                    email: "test@example.com",
                    phone: "0123456789",
                    address: "123 Test St",
                    city: "Test City",
                    postalCode: "12345",
                    country: "France"
                }
            };

            const response = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send(orderData);

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('Variant non trouvé');
        });

        it('should restore stock when cancelling an order', async () => {
            // D'abord créer une commande
            const orderData = {
                items: [{
                    product_id: testProduct.id,
                    quantity: 1,
                    variant: { size: "L", color: "Noir" }
                }],
                shipping_info: {
                    firstName: "Test",
                    lastName: "User",
                    email: "test@example.com",
                    phone: "0123456789",
                    address: "123 Test St",
                    city: "Test City",
                    postalCode: "12345",
                    country: "France"
                }
            };

            const orderResponse = await request(app)
                .post('/api/orders')
                .set('Authorization', `Bearer ${userToken}`)
                .send(orderData);

            expect(orderResponse.status).toBe(201);

            // Vérifier que le stock a diminué
            let productAfterOrder = await pool.query(
                'SELECT variants FROM products WHERE id = $1',
                [testProduct.id]
            );
            let variantAfterOrder = productAfterOrder.rows[0].variants.find(
                v => v.size === "L" && v.color === "Noir"
            );
            expect(variantAfterOrder.stock).toBe(1); // 2 - 1 = 1

            // Annuler la commande
            const cancelResponse = await request(app)
                .delete(`/api/orders/${orderResponse.body.id}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect(cancelResponse.status).toBe(200);

            // Vérifier que le stock a été restauré
            const productAfterCancel = await pool.query(
                'SELECT variants FROM products WHERE id = $1',
                [testProduct.id]
            );
            const variantAfterCancel = productAfterCancel.rows[0].variants.find(
                v => v.size === "L" && v.color === "Noir"
            );
            expect(variantAfterCancel.stock).toBe(2); // Retour au stock initial
        });
    });
}); 