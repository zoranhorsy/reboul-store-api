const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

module.exports = (req, res, next) => {
    try {
        // Vérifier si le token est présent
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: 'error',
                message: 'Token d\'authentification manquant'
            });
        }

        // Extraire et vérifier le token
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Ajouter l'utilisateur à la requête
        req.user = {
            id: decoded.id || decoded.userId,
            email: decoded.email,
            isAdmin: Boolean(decoded.isAdmin)
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
            return res.status(401).json({
                status: 'error',
                message: 'Token invalide'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: 'error',
                message: 'Token expiré'
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Erreur lors de l\'authentification'
        });
    }
};

