const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

// Obtenir toutes les marques (public)
router.get('/', async (req, res, next) => {
    try {
        const result = await db.query(
            'SELECT * FROM brands ORDER BY name ASC'
        );
        res.json(result.rows);
    } catch (error) {
        next(new AppError('Erreur lors de la récupération des marques', 500));
    }
});

// Obtenir une marque par ID
router.get('/:id', async (req, res, next) => {
    try {
        const result = await db.query(
            'SELECT * FROM brands WHERE id = $1',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return next(new AppError('Marque non trouvée', 404));
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        next(new AppError('Erreur lors de la récupération de la marque', 500));
    }
});

// Créer une nouvelle marque (admin seulement)
router.post('/', authMiddleware, async (req, res, next) => {
    const { name, description, logo_light, logo_dark } = req.body;
    
    try {
        const result = await db.query(
            `INSERT INTO brands (name, description, logo_light, logo_dark)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [name, description, logo_light, logo_dark]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        next(new AppError('Erreur lors de la création de la marque', 500));
    }
});

// Mettre à jour une marque (admin seulement)
router.put('/:id', authMiddleware, async (req, res, next) => {
    const { id } = req.params;
    const { name, description, logo_light, logo_dark } = req.body;
    
    try {
        const result = await db.query(
            `UPDATE brands 
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 logo_light = COALESCE($3, logo_light),
                 logo_dark = COALESCE($4, logo_dark),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $5
             RETURNING *`,
            [name, description, logo_light, logo_dark, id]
        );
        
        if (result.rows.length === 0) {
            return next(new AppError('Marque non trouvée', 404));
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        next(new AppError('Erreur lors de la mise à jour de la marque', 500));
    }
});

// Supprimer une marque (admin seulement)
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const result = await db.query(
            'DELETE FROM brands WHERE id = $1 RETURNING *',
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return next(new AppError('Marque non trouvée', 404));
        }
        
        res.json({ message: 'Marque supprimée avec succès' });
    } catch (error) {
        next(new AppError('Erreur lors de la suppression de la marque', 500));
    }
});

module.exports = router; 