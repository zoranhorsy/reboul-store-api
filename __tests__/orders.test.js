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

describe('Gestion des retours et remboursements', () => {
    let orderId;
    let orderItemId;
    let adminToken;

    beforeAll(async () => {
        // Créer un admin si besoin (déjà fait dans beforeAll principal)
        adminToken = userToken;

        // Créer une commande "livrée" pour tester les retours
        const orderData = {
            items: [{
                product_id: testProduct.id,
                quantity: 1,
                variant: { size: "M", color: "Noir" },
                product_name: "Test Product"
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
        orderId = response.body.id;
        // Forcer le statut à "delivered"
        await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['delivered', orderId]);
        // Récupérer l'order_item_id
        const itemsRes = await pool.query('SELECT id FROM order_items WHERE order_id = $1', [orderId]);
        orderItemId = itemsRes.rows[0].id;
    });

    afterAll(async () => {
        // Nettoyer les retours
        await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
        await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
    });

    it('Un client peut initier un retour sur une commande livrée', async () => {
        const retourData = {
            items: [{
                order_item_id: orderItemId,
                quantity: 1,
                reason: "Trop petit"
            }]
        };
        const res = await request(app)
            .patch(`/api/orders/${orderId}/return`)
            .set('Authorization', `Bearer ${userToken}`)
            .send(retourData);
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Demande de retour enregistrée');
        // Vérifier en base
        const item = await pool.query('SELECT return_status, return_quantity, return_reason FROM order_items WHERE id = $1', [orderItemId]);
        expect(item.rows[0].return_status).toBe('requested');
        expect(item.rows[0].return_quantity).toBe(1);
        expect(item.rows[0].return_reason).toBe('Trop petit');
    });

    it('Un admin peut valider un retour et le stock est ré-incrémenté', async () => {
        // Diminuer le stock à 0 pour tester la ré-incrémentation
        let variants = testProduct.variants;
        if (typeof variants === 'string') variants = JSON.parse(variants);
        variants.find(v => v.size === "M" && v.color === "Noir").stock = 0;
        await pool.query('UPDATE products SET variants = $1 WHERE id = $2', [JSON.stringify(variants), testProduct.id]);

        const res = await request(app)
            .patch(`/api/orders/${orderId}/return/validate`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                items: [{
                    order_item_id: orderItemId,
                    approved: true,
                    admin_comment: "Retour validé, produit conforme"
                }]
            });
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('traité');
        // Vérifier en base
        const item = await pool.query('SELECT return_status, admin_comment FROM order_items WHERE id = $1', [orderItemId]);
        expect(item.rows[0].return_status).toBe('approved');
        expect(item.rows[0].admin_comment).toBe('Retour validé, produit conforme');
        // Vérifier le stock ré-incrémenté
        const prod = await pool.query('SELECT variants FROM products WHERE id = $1', [testProduct.id]);
        const variant = prod.rows[0].variants.find(v => v.size === "M" && v.color === "Noir");
        expect(variant.stock).toBe(1);
    });

    it('Un admin peut marquer la commande comme remboursée', async () => {
        const res = await request(app)
            .patch(`/api/orders/${orderId}/mark-refunded`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ refund_id: 're_test123', admin_comment: 'Remboursement manuel' });
        expect(res.status).toBe(200);
        expect(res.body.message).toContain('remboursée');
        // Vérifier en base
        const order = await pool.query('SELECT refund_id, payment_status FROM orders WHERE id = $1', [orderId]);
        expect(order.rows[0].refund_id).toBe('re_test123');
        expect(order.rows[0].payment_status).toBe('refunded');
    });

    it('Un client ne peut pas initier un retour sur une commande non livrée', async () => {
        // Créer une commande "pending"
        const orderData = {
            items: [{
                product_id: testProduct.id,
                quantity: 1,
                variant: { size: "L", color: "Noir" },
                product_name: "Test Product"
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
        const pendingOrderId = response.body.id;
        const itemsRes = await pool.query('SELECT id FROM order_items WHERE order_id = $1', [pendingOrderId]);
        const pendingOrderItemId = itemsRes.rows[0].id;
        const retourData = {
            items: [{
                order_item_id: pendingOrderItemId,
                quantity: 1,
                reason: "Erreur"
            }]
        };
        const res = await request(app)
            .patch(`/api/orders/${pendingOrderId}/return`)
            .set('Authorization', `Bearer ${userToken}`)
            .send(retourData);
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('livrées');
        // Nettoyer
        await pool.query('DELETE FROM order_items WHERE order_id = $1', [pendingOrderId]);
        await pool.query('DELETE FROM orders WHERE id = $1', [pendingOrderId]);
    });

    it('Un client ne peut pas retourner plus que la quantité achetée', async () => {
        const retourData = {
            items: [{
                order_item_id: orderItemId,
                quantity: 10,
                reason: "Trop grand"
            }]
        };
        const res = await request(app)
            .patch(`/api/orders/${orderId}/return`)
            .set('Authorization', `Bearer ${userToken}`)
            .send(retourData);
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('dépasse la quantité achetée');
    });

    it('Un non-admin ne peut pas valider/refuser un retour', async () => {
        // Créer un autre utilisateur non admin
        const userResult = await pool.query(
            'INSERT INTO users (username, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, email, is_admin',
            ['user2', 'user2@example.com', 'hashedpassword', false]
        );
        const user2 = userResult.rows[0];
        const user2Token = jwt.sign(
            { id: user2.id, isAdmin: user2.is_admin },
            process.env.JWT_SECRET
        );
        const res = await request(app)
            .patch(`/api/orders/${orderId}/return/validate`)
            .set('Authorization', `Bearer ${user2Token}`)
            .send({
                items: [{
                    order_item_id: orderItemId,
                    approved: true
                }]
            });
        expect(res.status).toBe(403);
        expect(res.body.message).toContain('Accès non autorisé');
        // Nettoyer
        await pool.query('DELETE FROM users WHERE id = $1', [user2.id]);
    });

    it('Un non-admin ne peut pas marquer une commande comme remboursée', async () => {
        // Créer un autre utilisateur non admin
        const userResult = await pool.query(
            'INSERT INTO users (username, email, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, email, is_admin',
            ['user3', 'user3@example.com', 'hashedpassword', false]
        );
        const user3 = userResult.rows[0];
        const user3Token = jwt.sign(
            { id: user3.id, isAdmin: user3.is_admin },
            process.env.JWT_SECRET
        );
        const res = await request(app)
            .patch(`/api/orders/${orderId}/mark-refunded`)
            .set('Authorization', `Bearer ${user3Token}`)
            .send({ refund_id: 're_test456' });
        expect(res.status).toBe(403);
        expect(res.body.message).toContain('Accès non autorisé');
        // Nettoyer
        await pool.query('DELETE FROM users WHERE id = $1', [user3.id]);
    });
}); 