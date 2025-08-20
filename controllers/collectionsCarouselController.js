const db = require('../db');
const { AppError } = require('../middleware/errorHandler');

// Get all active collections for carousel (public)
exports.getAllCollections = async (req, res) => {
    try {
        const result = await db.pool.query(`
            SELECT * FROM collections_carousel 
            WHERE is_active = true 
            ORDER BY sort_order ASC, created_at ASC
        `);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error in getAllCollections:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération des collections' });
    }
};

// Get a single collection by ID (public)
exports.getCollectionById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.pool.query(
            'SELECT * FROM collections_carousel WHERE id = $1 AND is_active = true',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Collection non trouvée' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error in getCollectionById:', error);
        res.status(500).json({ message: 'Erreur lors de la récupération de la collection' });
    }
};

// Create a new collection (admin only)
exports.createCollection = async (req, res) => {
    try {
        const { name, description, image_url, link_url, badge, sort_order } = req.body;

        // Validation des champs requis
        if (!name || !description || !image_url || !link_url) {
            return res.status(400).json({ 
                message: 'Les champs name, description, image_url et link_url sont requis' 
            });
        }

        const result = await db.pool.query(
            `INSERT INTO collections_carousel (name, description, image_url, link_url, badge, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [name, description, image_url, link_url, badge, sort_order || 0]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error in createCollection:', error);
        res.status(500).json({ message: 'Erreur lors de la création de la collection' });
    }
};

// Update a collection (admin only)
exports.updateCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, image_url, link_url, badge, sort_order, is_active } = req.body;

        let query = 'UPDATE collections_carousel SET updated_at = CURRENT_TIMESTAMP';
        const values = [];
        const updates = [];

        if (name !== undefined) {
            updates.push(` name = $${values.length + 1}`);
            values.push(name);
        }

        if (description !== undefined) {
            updates.push(` description = $${values.length + 1}`);
            values.push(description);
        }

        if (image_url !== undefined) {
            updates.push(` image_url = $${values.length + 1}`);
            values.push(image_url);
        }

        if (link_url !== undefined) {
            updates.push(` link_url = $${values.length + 1}`);
            values.push(link_url);
        }

        if (badge !== undefined) {
            updates.push(` badge = $${values.length + 1}`);
            values.push(badge);
        }

        if (sort_order !== undefined) {
            updates.push(` sort_order = $${values.length + 1}`);
            values.push(sort_order);
        }

        if (is_active !== undefined) {
            updates.push(` is_active = $${values.length + 1}`);
            values.push(is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Aucune donnée à mettre à jour' });
        }

        query += ',' + updates.join(',');
        query += ` WHERE id = $${values.length + 1} RETURNING *`;
        values.push(id);

        const result = await db.pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Collection non trouvée' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error in updateCollection:', error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour de la collection' });
    }
};

// Delete a collection (admin only)
exports.deleteCollection = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.pool.query(
            'DELETE FROM collections_carousel WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Collection non trouvée' });
        }

        res.json({ message: 'Collection supprimée avec succès' });
    } catch (error) {
        console.error('Error in deleteCollection:', error);
        res.status(500).json({ message: 'Erreur lors de la suppression de la collection' });
    }
};

// Toggle collection active status (admin only)
exports.toggleCollectionStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.pool.query(
            `UPDATE collections_carousel 
             SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Collection non trouvée' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error in toggleCollectionStatus:', error);
        res.status(500).json({ message: 'Erreur lors du changement de statut de la collection' });
    }
};
