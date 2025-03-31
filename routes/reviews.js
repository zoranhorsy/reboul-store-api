const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// GET - Récupérer tous les avis d'un utilisateur
router.get('/', authMiddleware, async (req, res) => {
    try {
        console.log('Fetching reviews for user:', req.user.id);
        const { rows } = await pool.query(
            `SELECT r.*, p.name as product_name 
             FROM reviews r 
             JOIN products p ON r.product_id = p.id 
             WHERE r.user_id = $1 
             ORDER BY r.created_at DESC`,
            [req.user.id]
        );
        console.log('Found reviews:', rows);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des avis' });
    }
});

// POST - Ajouter un nouvel avis
router.post('/', authMiddleware, async (req, res) => {
    const { product_id, rating, comment } = req.body;
    
    if (!product_id || !rating || !comment) {
        return res.status(400).json({ message: 'Tous les champs sont requis' });
    }

    try {
        // Vérifier si le produit existe
        const productCheck = await pool.query(
            'SELECT id FROM products WHERE id = $1',
            [product_id]
        );

        if (productCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }

        // Vérifier si l'utilisateur a déjà donné son avis sur ce produit
        const existingReview = await pool.query(
            'SELECT id FROM reviews WHERE user_id = $1 AND product_id = $2',
            [req.user.id, product_id]
        );

        if (existingReview.rows.length > 0) {
            return res.status(400).json({ message: 'Vous avez déjà donné votre avis sur ce produit' });
        }

        // Créer la table reviews si elle n'existe pas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                product_id INTEGER REFERENCES products(id),
                rating INTEGER CHECK (rating >= 1 AND rating <= 5),
                comment TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const { rows } = await pool.query(
            `INSERT INTO reviews (user_id, product_id, rating, comment) 
             VALUES ($1, $2, $3, $4) 
             RETURNING *`,
            [req.user.id, product_id, rating, comment]
        );

        // Récupérer le nom du produit pour la réponse
        const productInfo = await pool.query(
            'SELECT name FROM products WHERE id = $1',
            [product_id]
        );

        const response = {
            ...rows[0],
            product_name: productInfo.rows[0].name
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error adding review:', error);
        res.status(500).json({ message: 'Erreur lors de l\'ajout de l\'avis' });
    }
});

// PUT - Mettre à jour un avis
router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;
    
    if (!rating || !comment) {
        return res.status(400).json({ message: 'La note et le commentaire sont requis' });
    }

    try {
        const { rows } = await pool.query(
            `UPDATE reviews 
             SET rating = $1, comment = $2, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $3 AND user_id = $4 
             RETURNING *`,
            [rating, comment, id, req.user.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Avis non trouvé' });
        }

        // Récupérer le nom du produit
        const productInfo = await pool.query(
            'SELECT name FROM products WHERE id = $1',
            [rows[0].product_id]
        );

        const response = {
            ...rows[0],
            product_name: productInfo.rows[0].name
        };

        res.json(response);
    } catch (error) {
        console.error('Error updating review:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'avis' });
    }
});

// DELETE - Supprimer un avis
router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            'DELETE FROM reviews WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.user.id]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Avis non trouvé' });
        }
        
        res.json({ message: 'Avis supprimé avec succès' });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression de l\'avis' });
    }
});

module.exports = router; 