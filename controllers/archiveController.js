const db = require('../db');
const { AppError } = require('../middleware/errorHandler');
const path = require('path');
const fs = require('fs').promises;

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

        const { title, description, category, date, active } = req.body;
        let image_path = null;

        if (req.file) {
            const imageFolder = `/archives/${category}`;
            const publicPath = path.join(process.cwd(), 'public', imageFolder);
            await fs.mkdir(publicPath, { recursive: true });
            
            const fileName = `${Date.now()}-${req.file.originalname}`;
            image_path = `${imageFolder}/${fileName}`;
            
            await fs.writeFile(
                path.join(process.cwd(), 'public', image_path),
                req.file.buffer
            );
        }

        const result = await db.query(
            `INSERT INTO archives (title, description, category, image_path, date, active)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [title, description, category, image_path, date, active]
        );

        res.status(201).json({
            status: 'success',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Erreur lors de la création de l\'archive:', error);
        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de la création de l\'archive'
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
        const { title, description, category, date, active } = req.body;
        let image_path = null;

        if (req.file) {
            // Supprimer l'ancienne image si elle existe
            const oldImage = await db.query(
                'SELECT image_path FROM archives WHERE id = $1',
                [id]
            );
            
            if (oldImage.rows[0]?.image_path) {
                const oldPath = path.join(process.cwd(), 'public', oldImage.rows[0].image_path);
                await fs.unlink(oldPath).catch(() => {});
            }

            // Sauvegarder la nouvelle image
            const imageFolder = `/archives/${category}`;
            const publicPath = path.join(process.cwd(), 'public', imageFolder);
            await fs.mkdir(publicPath, { recursive: true });
            
            const fileName = `${Date.now()}-${req.file.originalname}`;
            image_path = `${imageFolder}/${fileName}`;
            
            await fs.writeFile(
                path.join(process.cwd(), 'public', image_path),
                req.file.buffer
            );
        }

        const result = await db.query(
            `UPDATE archives 
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 category = COALESCE($3, category),
                 image_path = COALESCE($4, image_path),
                 date = COALESCE($5, date),
                 active = COALESCE($6, active)
             WHERE id = $7
             RETURNING *`,
            [title, description, category, image_path, date, active, id]
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
        
        // Récupérer l'image avant la suppression
        const image = await db.query(
            'SELECT image_path FROM archives WHERE id = $1',
            [id]
        );

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

        // Supprimer l'image du système de fichiers
        if (image.rows[0]?.image_path) {
            const imagePath = path.join(process.cwd(), 'public', image.rows[0].image_path);
            await fs.unlink(imagePath).catch(() => {});
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