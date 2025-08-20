const db = require('../db');

async function checkAndCreateCollectionsTable() {
    try {
        console.log('Vérification de la table collections_carousel...');
        
        // Vérifier si la table existe
        const tableExists = await db.pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'collections_carousel'
            );
        `);
        
        if (!tableExists.rows[0].exists) {
            console.log('Table collections_carousel n\'existe pas, création...');
            
            // Créer la table
            await db.pool.query(`
                CREATE TABLE collections_carousel (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    image_url TEXT NOT NULL,
                    link_url TEXT NOT NULL,
                    badge TEXT,
                    sort_order INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `);
            
            // Créer les index
            await db.pool.query(`
                CREATE INDEX idx_collections_carousel_active ON collections_carousel(is_active);
                CREATE INDEX idx_collections_carousel_sort_order ON collections_carousel(sort_order);
            `);
            
            // Insérer des données de démonstration
            await db.pool.query(`
                INSERT INTO collections_carousel (name, description, image_url, link_url, badge, sort_order, is_active) VALUES
                    ('Collection CP Company', 'Design italien - Les essentiels CP Company', '/public/uploads/collections/cp-company.jpg', '/catalogue?brand=cp-company', 'Tendance', 1, true),
                    ('Collection Sneakers', 'Les dernières nouveautés en sneakers', '/public/uploads/collections/sneakers-collection.jpg', '/catalogue?category=sneakers', 'Nouveau', 2, true),
                    ('Collection Adultes', 'Élégance contemporaine pour adultes', '/public/uploads/collections/adult-collection.jpg', '/catalogue?category=adult', 'Populaire', 3, true),
                    ('Collection Kids', 'Style et confort pour les plus jeunes', '/public/uploads/collections/kids-collection.jpg', '/catalogue?category=kids', 'Exclusif', 4, true);
            `);
            
            console.log('Table collections_carousel créée avec succès !');
        } else {
            console.log('Table collections_carousel existe déjà.');
            
            // Vérifier s'il y a des données
            const count = await db.pool.query('SELECT COUNT(*) FROM collections_carousel WHERE is_active = true');
            console.log(`Nombre de collections actives: ${count.rows[0].count}`);
        }
        
    } catch (error) {
        console.error('Erreur lors de la vérification/création de la table:', error);
    } finally {
        await db.pool.end();
    }
}

checkAndCreateCollectionsTable();
