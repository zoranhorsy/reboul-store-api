const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

// GET - Récupérer toutes les adresses d'un utilisateur
router.get('/', authMiddleware, async (req, res) => {
    try {
        console.log('Fetching addresses for user:', req.user.id);
        const { rows } = await pool.query(
            'SELECT * FROM addresses WHERE user_id = $1',
            [req.user.id]
        );
        console.log('Found addresses:', rows);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des adresses' });
    }
});

// POST - Ajouter une nouvelle adresse
router.post('/', authMiddleware, async (req, res) => {
    const { street, city, postal_code, country } = req.body;
    try {
        const { rows } = await pool.query(
            'INSERT INTO addresses (user_id, street, city, postal_code, country) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [req.user.id, street, city, postal_code, country]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).json({ message: 'Erreur lors de l\'ajout de l\'adresse' });
    }
});

// PUT - Mettre à jour une adresse
router.put('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { street, city, postal_code, country } = req.body;
    try {
        const { rows } = await pool.query(
            'UPDATE addresses SET street = $1, city = $2, postal_code = $3, country = $4 WHERE id = $5 AND user_id = $6 RETURNING *',
            [street, city, postal_code, country, id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Adresse non trouvée' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error updating address:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de l\'adresse' });
    }
});

// DELETE - Supprimer une adresse
router.delete('/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *',
            [id, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Adresse non trouvée' });
        }
        res.json({ message: 'Adresse supprimée avec succès' });
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression de l\'adresse' });
    }
});

module.exports = router; 