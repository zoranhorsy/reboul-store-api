const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const authMiddleware = require('../middleware/auth');

// Middleware de validation
const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

                const extractedErrors = errors.array().map(err => ({ [err.param]: err.msg }));
                return next(new AppError(JSON.stringify(extractedErrors), 400));
            };
        };

        // Fonction pour récupérer un utilisateur par son ID
        const getUserById = async (userId) => {
            const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
            if (rows.length === 0) {
                throw new AppError('Utilisateur non trouvé', 404);
            }
            return rows[0];
        };

        // Inscription
        router.post('/inscription',
            [
                body('username').notEmpty().withMessage('Le nom d\'utilisateur est requis'),
                body('email').isEmail().withMessage('L\'email doit être valide'),
                body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
            ],
            validate([body('username'), body('email'), body('password')]),
            async (req, res, next) => {
                const { username, email, password } = req.body;
                try {
                    // Check if user already exists
                    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
                    if (userCheck.rows.length > 0) {
                        return next(new AppError('Un utilisateur avec cet email existe déjà', 400));
                    }

                    // Hash password
                    const saltRounds = 10;
                    const passwordHash = await bcrypt.hash(password, saltRounds);

                    // Insert new user
                    const { rows } = await pool.query(
                        'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username, is_admin',
                        [username, email, passwordHash]
                    );

                    const newUser = rows[0];

                    // Generate JWT
                    const token = jwt.sign(
                        { userId: newUser.id, username: newUser.username, isAdmin: newUser.is_admin },
                        process.env.JWT_SECRET,
                        { expiresIn: '1h' }
                    );

                    res.status(201).json({
                        message: 'Inscription réussie',
                        token,
                        user: {
                            id: newUser.id,
                            email: newUser.email,
                            username: newUser.username,
                            is_admin: newUser.is_admin
                        }
                    });
                } catch (err) {
                    console.error('Erreur lors de l\'inscription:', err);
                    next(new AppError('Erreur lors de l\'inscription', 500));
                }
            });

        // Connexion
        router.post('/login',
            [
                body('email').isEmail().withMessage('L\'email doit être valide'),
                body('password').notEmpty().withMessage('Le mot de passe est requis'),
            ],
            validate([body('email'), body('password')]),
            async (req, res, next) => {
                const { email, password } = req.body;
                try {
                    console.log('=== DÉBUT LOGIN ===');
                    console.log('Email reçu:', email);
                    console.log('Headers:', req.headers);

                    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
                    console.log('Résultat requête:', rows.length > 0 ? '✅ Utilisateur trouvé' : '❌ Utilisateur non trouvé');
                    
                    if (rows.length === 0) {
                        console.log('❌ Authentification échouée: utilisateur non trouvé');
                        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
                    }

                    const user = rows[0];
                    console.log('Données utilisateur:', {
                        id: user.id,
                        email: user.email,
                        isAdmin: user.is_admin
                    });

                    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
                    console.log('Mot de passe valide:', isPasswordValid ? '✅' : '❌');

                    if (!isPasswordValid) {
                        console.log('❌ Authentification échouée: mot de passe invalide');
                        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
                    }

                    const tokenPayload = {
                        userId: user.id,
                        username: user.username,
                        isAdmin: user.is_admin
                    };
                    console.log('Payload du token:', tokenPayload);

                    const token = jwt.sign(
                        tokenPayload,
                        process.env.JWT_SECRET,
                        { expiresIn: '1h' }
                    );
                    console.log('Token généré:', token.substring(0, 20) + '...');

                    const response = {
                        message: 'Connexion réussie',
                        token,
                        user: {
                            id: user.id,
                            email: user.email,
                            username: user.username,
                            is_admin: user.is_admin
                        }
                    };
                    console.log('=== FIN LOGIN - SUCCÈS ===');
                    res.json(response);
                } catch (err) {
                    console.error('❌ Erreur login:', err);
                    next(new AppError('Erreur lors de la connexion', 500));
                }
            });

        router.get('/me', authMiddleware, async (req, res) => {
            try {
                console.log('=== DÉBUT /auth/me ===');
                console.log('Utilisateur authentifié:', req.user);
                
                const user = await getUserById(req.user.id);
                console.log('Données utilisateur complètes:', user);
                
                const response = {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    is_admin: user.is_admin,
                    avatar_url: user.avatar_url,
                    phone: user.phone
                };
                
                console.log('Réponse envoyée:', response);
                console.log('=== FIN /auth/me ===');
                
                res.json(response);
            } catch (error) {
                console.error('Erreur /me:', error);
                res.status(500).json({ message: 'Erreur lors de la récupération des informations utilisateur' });
            }
        });

        router.put('/update-password', authMiddleware, async (req, res, next) => {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.userId;

            try {
                // Récupérer l'utilisateur de la base de données
                const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE id = $1', [userId]);
                if (rows.length === 0) {
                    return next(new AppError('Utilisateur non trouvé', 404));
                }

                const user = rows[0];

                // Vérifier le mot de passe actuel
                const isPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
                if (!isPasswordValid) {
                    return next(new AppError('Mot de passe actuel incorrect', 401));
                }
                // Hasher le nouveau mot de passe
                const saltRounds = 10;
                const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

                // Mettre à jour le hash du mot de passe dans la base de données
                await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);

                res.json({ message: 'Mot de passe mis à jour avec succès' });
            } catch (err) {
                console.error('Erreur lors de la mise à jour du mot de passe:', err);
                next(new AppError('Erreur lors de la mise à jour du mot de passe', 500));
            }
        });

        module.exports = router;