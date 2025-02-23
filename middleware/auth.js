const jwt = require('jsonwebtoken');
const db = require('../db');
const { AppError } = require('./errorHandler');

const authMiddleware = async (req, res, next) => {
    try {
        // Récupérer le token du header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token non fourni' });
        }

        const token = authHeader.split(' ')[1];
        
        // Vérifier et décoder le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Récupérer l'utilisateur de la base de données
        const result = await db.query(
            'SELECT id, email, username, is_admin FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        // Ajouter l'utilisateur à l'objet request
        req.user = {
            id: result.rows[0].id,
            email: result.rows[0].email,
            username: result.rows[0].username,
            isAdmin: result.rows[0].is_admin
        };

        // Vérification des routes admin
        if ((req.originalUrl.startsWith('/admin') || req.originalUrl.startsWith('/api/stats')) && !req.user.isAdmin) {
            console.log('Tentative d\'accès non autorisé à une route admin');
            return next(new AppError('Accès non autorisé', 403));
        }

        next();
    } catch (error) {
        console.error('Erreur d\'authentification:', error);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token invalide' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expiré' });
        }
        res.status(500).json({ error: 'Erreur lors de l\'authentification' });
    }
};

module.exports = authMiddleware;

