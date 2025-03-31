const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const authMiddleware = require('../middleware/auth');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Configuration du transporter nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

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

        // Fonction pour générer un token de réinitialisation
        const generateResetToken = () => {
            return crypto.randomBytes(32).toString('hex');
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

        // Demande de réinitialisation de mot de passe
        router.post('/forgot-password',
            [
                body('email').isEmail().withMessage('L\'email doit être valide'),
            ],
            validate([body('email')]),
            async (req, res, next) => {
                const { email } = req.body;
                try {
                    console.log('=== DÉBUT DEMANDE RÉINITIALISATION MOT DE PASSE ===');
                    console.log('Email reçu:', email);

                    // Vérifier si l'utilisateur existe
                    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
                    if (rows.length === 0) {
                        console.log('⚠️ Utilisateur non trouvé pour l\'email:', email);
                        // Pour des raisons de sécurité, ne pas indiquer si l'email existe
                        return res.json({ message: 'Si cette adresse email est associée à un compte, vous recevrez un email avec les instructions pour réinitialiser votre mot de passe.' });
                    }

                    const user = rows[0];
                    console.log('Utilisateur trouvé:', {
                        id: user.id,
                        email: user.email,
                    });

                    // Générer un token de réinitialisation
                    const resetToken = generateResetToken();
                    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 heure

                    // Stocker le token en base de données
                    await pool.query(
                        'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
                        [resetToken, resetTokenExpires, user.id]
                    );
                    console.log('Token de réinitialisation généré et stocké');

                    // URL pour réinitialiser le mot de passe
                    // L'URL de base doit être configurée selon l'environnement
                    const baseUrl = process.env.NODE_ENV === 'production' 
                        ? (process.env.FRONTEND_URL || 'https://reboulreactversion0.vercel.app') 
                        : 'http://localhost:3000';
                    const resetUrl = `${baseUrl}/reinitialiser-mot-de-passe/${resetToken}`;

                    // Envoyer l'email
                    const mailOptions = {
                        from: `"Reboul Store" <${process.env.SMTP_USER}>`,
                        to: user.email,
                        subject: 'Réinitialisation de votre mot de passe',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                                <h1 style="color: #333; text-align: center;">Réinitialisation de mot de passe</h1>
                                <p>Bonjour ${user.username},</p>
                                <p>Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
                                
                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="${resetUrl}" style="background-color: #4a4a4a; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                        Réinitialiser mon mot de passe
                                    </a>
                                </div>
                                
                                <p>Si vous n'avez pas demandé à réinitialiser votre mot de passe, vous pouvez ignorer cet email.</p>
                                <p>Ce lien expirera dans 1 heure.</p>
                                
                                <p style="margin-top: 30px;">Cordialement,<br>L'équipe Reboul Store</p>
                                
                                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #888;">
                                    <p>Cet email est envoyé automatiquement, merci de ne pas y répondre.</p>
                                </div>
                            </div>
                        `
                    };

                    await transporter.sendMail(mailOptions);
                    console.log('Email de réinitialisation envoyé à:', email);

                    console.log('=== FIN DEMANDE RÉINITIALISATION MOT DE PASSE - SUCCÈS ===');
                    res.json({ message: 'Si cette adresse email est associée à un compte, vous recevrez un email avec les instructions pour réinitialiser votre mot de passe.' });
                } catch (err) {
                    console.error('❌ Erreur lors de la demande de réinitialisation:', err);
                    
                    // Pour le débogage, inclure les détails de l'erreur dans la réponse
                    return res.status(500).json({ 
                        status: 'error', 
                        message: 'Erreur lors de la demande de réinitialisation de mot de passe',
                        debug: process.env.NODE_ENV !== 'production' ? {
                            error: err.message,
                            stack: err.stack,
                            smtpConfig: {
                                host: process.env.SMTP_HOST,
                                port: process.env.SMTP_PORT,
                                secure: process.env.SMTP_SECURE,
                                user: process.env.SMTP_USER,
                                // Ne pas inclure le mot de passe pour des raisons de sécurité
                            }
                        } : undefined
                    });
                    
                    // Commenté pour le moment pour permettre le débogage
                    // next(new AppError('Erreur lors de la demande de réinitialisation de mot de passe', 500));
                }
            }
        );

        // Réinitialisation du mot de passe
        router.post('/reset-password',
            [
                body('token').notEmpty().withMessage('Le token est requis'),
                body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
            ],
            validate([body('token'), body('password')]),
            async (req, res, next) => {
                const { token, password } = req.body;
                try {
                    console.log('=== DÉBUT RÉINITIALISATION MOT DE PASSE ===');
                    console.log('Token reçu:', token);

                    // Vérifier si le token existe et n'a pas expiré
                    const { rows } = await pool.query(
                        'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2',
                        [token, new Date()]
                    );

                    if (rows.length === 0) {
                        console.log('❌ Token invalide ou expiré');
                        return next(new AppError('Token invalide ou expiré', 400));
                    }

                    const user = rows[0];
                    console.log('Utilisateur trouvé:', {
                        id: user.id,
                        email: user.email,
                    });

                    // Hasher le nouveau mot de passe
                    const saltRounds = 10;
                    const newPasswordHash = await bcrypt.hash(password, saltRounds);
                    console.log('Nouveau mot de passe hashé');

                    // Mettre à jour le mot de passe et réinitialiser le token
                    await pool.query(
                        'UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL WHERE id = $2',
                        [newPasswordHash, user.id]
                    );
                    console.log('Mot de passe mis à jour');

                    // Envoyer un email de confirmation
                    const mailOptions = {
                        from: `"Reboul Store" <${process.env.SMTP_USER}>`,
                        to: user.email,
                        subject: 'Votre mot de passe a été réinitialisé',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                                <h1 style="color: #333; text-align: center;">Mot de passe réinitialisé</h1>
                                <p>Bonjour ${user.username},</p>
                                <p>Votre mot de passe a été réinitialisé avec succès.</p>
                                <p>Si vous n'avez pas effectué cette action, veuillez contacter immédiatement notre support à l'adresse suivante : support@reboulstore.com</p>
                                
                                <p style="margin-top: 30px;">Cordialement,<br>L'équipe Reboul Store</p>
                                
                                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; font-size: 12px; color: #888;">
                                    <p>Cet email est envoyé automatiquement, merci de ne pas y répondre.</p>
                                </div>
                            </div>
                        `
                    };

                    await transporter.sendMail(mailOptions);
                    console.log('Email de confirmation envoyé');

                    console.log('=== FIN RÉINITIALISATION MOT DE PASSE - SUCCÈS ===');
                    res.json({ message: 'Votre mot de passe a été réinitialisé avec succès' });
                } catch (err) {
                    console.error('❌ Erreur lors de la réinitialisation du mot de passe:', err);
                    next(new AppError('Erreur lors de la réinitialisation du mot de passe', 500));
                }
            }
        );

        // Vérification de la validité d'un token de réinitialisation
        router.post('/verify-token',
            [
                body('token').notEmpty().withMessage('Le token est requis'),
            ],
            validate([body('token')]),
            async (req, res, next) => {
                const { token } = req.body;
                try {
                    console.log('=== DÉBUT VÉRIFICATION TOKEN ===');
                    console.log('Token reçu:', token);

                    // Vérifier si le token existe et n'a pas expiré
                    const { rows } = await pool.query(
                        'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2',
                        [token, new Date()]
                    );

                    if (rows.length === 0) {
                        console.log('❌ Token invalide ou expiré');
                        return next(new AppError('Token invalide ou expiré', 400));
                    }

                    const user = rows[0];
                    console.log('Utilisateur trouvé:', {
                        id: user.id,
                        email: user.email,
                    });

                    console.log('=== FIN VÉRIFICATION TOKEN - SUCCÈS ===');
                    // Pour des raisons de sécurité, on peut choisir de ne pas renvoyer l'email
                    // Mais pour l'affichage dans l'interface, c'est utile
                    res.json({ 
                        valid: true, 
                        email: user.email 
                    });
                } catch (err) {
                    console.error('❌ Erreur lors de la vérification du token:', err);
                    next(new AppError('Erreur lors de la vérification du token', 500));
                }
            }
        );

        module.exports = router;