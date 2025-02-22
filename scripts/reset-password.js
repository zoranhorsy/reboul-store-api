const pool = require('../db');
const bcrypt = require('bcrypt');

async function resetPassword(email, newPassword) {
    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        const result = await pool.query(
            'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING *',
            [hashedPassword, email]
        );

        if (result.rows.length > 0) {
            console.log('Mot de passe mis à jour pour:', result.rows[0].email);
            return true;
        } else {
            console.log('Aucun utilisateur trouvé avec cet email');
            return false;
        }
    } catch (error) {
        console.error('Erreur lors de la réinitialisation du mot de passe:', error);
        return false;
    } finally {
        await pool.end();
    }
}

// Utilisation du script
const email = 'zoran@reboul.com';
const newPassword = 'nouveauMotDePasse123';

resetPassword(email, newPassword)
    .then(success => {
        if (success) {
            console.log('Mot de passe réinitialisé avec succès');
        } else {
            console.log('Échec de la réinitialisation du mot de passe');
        }
    });

