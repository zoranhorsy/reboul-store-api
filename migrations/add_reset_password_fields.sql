-- Ajout des colonnes pour la réinitialisation de mot de passe
ALTER TABLE users 
ADD COLUMN reset_password_token VARCHAR(255) DEFAULT NULL,
ADD COLUMN reset_password_expires TIMESTAMP DEFAULT NULL;

-- Ajout d'un index pour accélérer les recherches par token
CREATE INDEX idx_users_reset_token ON users(reset_password_token);

-- Log
SELECT 'Migration réussie: colonnes reset_password_token et reset_password_expires ajoutées à la table users' as message; 