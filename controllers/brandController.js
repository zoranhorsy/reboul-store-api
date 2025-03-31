const db = require('../db');
const { AppError } = require('../middleware/errorHandler');

// Get all brands
exports.getAllBrands = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM brands ORDER BY name ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error in getAllBrands:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des marques' });
    }
};

// Create a new brand
exports.createBrand = async (req, res) => {
    try {
        const { name, logo_light, logo_dark } = req.body;

        // Check if brand already exists
        const existingBrand = await db.query('SELECT * FROM brands WHERE name = $1', [name]);
        if (existingBrand.rows.length > 0) {
            return res.status(400).json({ message: 'Cette marque existe déjà' });
        }

        const result = await db.query(
            'INSERT INTO brands (name, logo_light, logo_dark) VALUES ($1, $2, $3) RETURNING *',
            [
                name,
                logo_light || '/placeholder.png',
                logo_dark || '/placeholder.png'
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error in createBrand:', error);
        res.status(500).json({ message: 'Erreur lors de la création de la marque' });
    }
};

// Update a brand
exports.updateBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, logo_light, logo_dark } = req.body;

        let query = 'UPDATE brands SET';
        const values = [];
        const updates = [];

        if (name) {
            updates.push(` name = $${values.length + 1}`);
            values.push(name);
        }

        if (logo_light) {
            updates.push(` logo_light = $${values.length + 1}`);
            values.push(logo_light);
        }

        if (logo_dark) {
            updates.push(` logo_dark = $${values.length + 1}`);
            values.push(logo_dark);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Aucune donnée à mettre à jour' });
        }

        query += updates.join(',');
        query += ` WHERE id = $${values.length + 1} RETURNING *`;
        values.push(id);

        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Marque non trouvée' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error in updateBrand:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de la marque' });
    }
};

// Delete a brand
exports.deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier si la marque est utilisée dans des produits
        const productsCheck = await db.query('SELECT COUNT(*) FROM products WHERE brand IN (SELECT name FROM brands WHERE id = $1)', [id]);
        if (productsCheck.rows[0].count > 0) {
            return res.status(400).json({ 
                message: 'Cette marque ne peut pas être supprimée car elle est utilisée par des produits' 
            });
        }

        const result = await db.query('DELETE FROM brands WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Marque non trouvée' });
        }

        res.json({ message: 'Marque supprimée avec succès' });
    } catch (error) {
        console.error('Error in deleteBrand:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression de la marque' });
    }
};