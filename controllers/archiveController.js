const db = require('../db');
const { AppError } = require('../middleware/errorHandler');

// Obtenir toutes les archives actives (pour l'affichage public)
exports.getAllActiveArchives = async (req, res) => {
    try {
        const result = await db.query(
            `SELECT * FROM archives 
             WHERE active = true 
             ORDER BY date DESC`
        );
        
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des archives actives:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la récupération des archives actives'
        });
    }
};

// Obtenir toutes les archives (pour l'admin)
exports.getAllArchives = async (req, res) => {
    try {
        if (!req.user || !req.user.isAdmin) {
            return res.status(403).json({
                status: 'error',
                message: 'Accès non autorisé'
            });
        }

        const result = await db.query(
            `SELECT * FROM archives 
             ORDER BY date DESC`
        );
        
        res.json({
            status: 'success',
            data: result.rows
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des archives:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la récupération des archives'
        });
    }
};

// Créer une nouvelle archive
exports.createArchive = async (req, res) => {
    try {
        if (!req.user || !req.user.isAdmin) {
            return res.status(403).json({
                status: 'error',
                message: 'Accès non autorisé'
            });
        }

        console.log('Données reçues pour la création:', req.body);
        console.log('Headers:', req.headers);

        const { title, description, category, date, active, image_paths } = req.body;

        // Vérifier que tous les champs requis sont présents
        if (!title || !description || !category || !date || !image_paths || !Array.isArray(image_paths)) {
            console.error('Champs manquants ou invalides:', { title, description, category, date, image_paths });
            return res.status(400).json({
                status: 'error',
                message: 'Tous les champs sont requis et image_paths doit être un tableau'
            });
        }

        console.log('Tentative d\'insertion avec les valeurs:', {
            title,
            description,
            category,
            date,
            active,
            image_paths
        });

        const result = await db.query(
            `INSERT INTO archives (title, description, category, date, active, image_paths)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [title, description, category, date, active, image_paths]
        );

        console.log('Archive créée avec succès:', result.rows[0]);

        res.status(201).json({
            status: 'success',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur détaillée lors de la création de l\'archive:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la création de l\'archive',
            error: error.message
        });
    }
};

// Mettre à jour une archive
exports.updateArchive = async (req, res) => {
    try {
        if (!req.user || !req.user.isAdmin) {
            return res.status(403).json({
                status: 'error',
                message: 'Accès non autorisé'
            });
        }

        const { id } = req.params;
        const { title, description, category, date, active, image_paths } = req.body;

        // Vérifier que image_paths est un tableau s'il est fourni
        if (image_paths !== undefined && !Array.isArray(image_paths)) {
            return res.status(400).json({
                status: 'error',
                message: 'image_paths doit être un tableau'
            });
        }

        const result = await db.query(
            `UPDATE archives 
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 category = COALESCE($3, category),
                 image_paths = COALESCE($4, image_paths),
                 date = COALESCE($5, date),
                 active = COALESCE($6, active)
             WHERE id = $7
             RETURNING *`,
            [title, description, category, image_paths, date, active, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Archive non trouvée'
            });
        }

        res.json({
            status: 'success',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'archive:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la mise à jour de l\'archive'
        });
    }
};

// Supprimer une archive
exports.deleteArchive = async (req, res) => {
    try {
        if (!req.user || !req.user.isAdmin) {
            return res.status(403).json({
                status: 'error',
                message: 'Accès non autorisé'
            });
        }

        const { id } = req.params;
        
        // Supprimer l'archive de la base de données
        const result = await db.query(
            'DELETE FROM archives WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Archive non trouvée'
            });
        }

        res.json({
            status: 'success',
            message: 'Archive supprimée avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'archive:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la suppression de l\'archive'
        });
    }
}; 