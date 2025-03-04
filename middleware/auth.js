const jwt = require('jsonwebtoken');
const db = require('../db');
const { AppError } = require('./errorHandler');

const authMiddleware = async (req, res, next) => {
    try {
        console.log('=== DÉBUT AUTH MIDDLEWARE ===');
        console.log('URL:', req.originalUrl);
        console.log('Headers:', {
            authorization: req.headers.authorization ? req.headers.authorization.substring(0, 30) + '...' : 'undefined',
            origin: req.headers.origin,
            referer: req.headers.referer
        });
        console.log('Method:', req.method);
        console.log('IP:', req.ip);

        // Récupérer le token du header Authorization
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('❌ Pas de token dans les headers');
            return res.status(401).json({ error: 'Token non fourni' });
        }

        const token = authHeader.split(' ')[1];
        console.log('Token reçu:', token.substring(0, 20) + '...');
        
        // Vérifier et décoder le token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('✅ Token décodé:', decoded);
        } catch (jwtError) {
            console.log('❌ Erreur de décodage JWT:', jwtError.message);
            throw jwtError;
        }
        
        // Récupérer l'utilisateur de la base de données
        console.log('Recherche utilisateur avec ID:', decoded.userId);
        const result = await db.query(
            'SELECT id, email, username, is_admin FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            console.log('❌ Utilisateur non trouvé en DB');
            return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }

        console.log('✅ Utilisateur trouvé:', result.rows[0]);

        // Ajouter l'utilisateur à l'objet request
        req.user = {
            id: result.rows[0].id,
            userId: result.rows[0].id,
            email: result.rows[0].email,
            username: result.rows[0].username,
            isAdmin: result.rows[0].is_admin
        };

        // Vérification des routes admin
        if ((req.originalUrl.startsWith('/admin') || req.originalUrl.startsWith('/api/stats')) && !req.user.isAdmin) {
            console.log('❌ Tentative d\'accès non autorisé à une route admin');
            return next(new AppError('Accès non autorisé', 403));
        }

        console.log('=== FIN AUTH MIDDLEWARE - SUCCÈS ===');
        next();
    } catch (error) {
        console.error('❌ Erreur d\'authentification:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });

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

