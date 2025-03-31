class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    console.error('Erreur détaillée:', err);

    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } else {
        // En production
        if (err.isOperational) {
            res.status(err.statusCode).json({
                status: err.status,
                message: err.message
            });
        } else {
            // Gestion des erreurs spécifiques
            if (err.name === 'SequelizeValidationError') {
                const errors = err.errors.map(e => ({ [e.path]: e.message }));
                return res.status(400).json({
                    status: 'fail',
                    message: 'Erreur de validation',
                    errors: errors
                });
            }

            if (err.name === 'SequelizeUniqueConstraintError') {
                const errors = err.errors.map(e => ({ [e.path]: e.message }));
                return res.status(409).json({
                    status: 'fail',
                    message: 'Conflit de données',
                    errors: errors
                });
            }

            if (err.name === 'SequelizeDatabaseError' || err.name === 'SequelizeConnectionError') {
                return res.status(500).json({
                    status: 'error',
                    message: 'Erreur de base de données'
                });
            }

            if (err.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    status: 'fail',
                    message: 'Token invalide'
                });
            }

            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    status: 'fail',
                    message: 'Token expiré'
                });
            }

            // Erreur non opérationnelle : ne pas divulguer les détails
            console.error('ERROR 💥', err);
            res.status(500).json({
                status: 'error',
                message: 'Une erreur inattendue s\'est produite'
            });
        }
    }
};

module.exports = { AppError, errorHandler };

