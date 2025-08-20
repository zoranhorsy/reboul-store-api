const pool = require('../config/database');

// Récupérer toutes les collections actives du carousel
const getCollectionsCarousel = async (req, res) => {
  try {
    // Données de test temporaires
    const testData = [
      {
        id: 1,
        name: "Collection CP Company",
        description: "Design italien - Les essentiels CP Company",
        image_url: "/images/collections/cp-company.jpg",
        link_url: "/catalogue?brand=cp-company",
        badge: "Tendance",
        sort_order: 1
      },
      {
        id: 2,
        name: "Collection Sneakers",
        description: "Les dernières nouveautés en sneakers",
        image_url: "/images/collections/sneakers-collection.jpg",
        link_url: "/catalogue?category=sneakers",
        badge: "Nouveau",
        sort_order: 2
      },
      {
        id: 3,
        name: "Collection Adultes",
        description: "Élégance contemporaine pour adultes",
        image_url: "/images/collections/adult-collection.jpg",
        link_url: "/catalogue?category=adult",
        badge: "Populaire",
        sort_order: 3
      },
      {
        id: 4,
        name: "Collection Kids",
        description: "Style et confort pour les plus jeunes",
        image_url: "/images/collections/kids-collection.jpg",
        link_url: "/catalogue?category=kids",
        badge: "Exclusif",
        sort_order: 4
      }
    ];
    
    res.json({
      success: true,
      data: testData
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des collections carousel:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des collections'
    });
  }
};

// Récupérer une collection par ID
const getCollectionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT id, name, description, image_url, link_url, badge, sort_order, is_active
      FROM collections_carousel 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la collection:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la collection'
    });
  }
};

// Créer une nouvelle collection
const createCollection = async (req, res) => {
  try {
    const { name, description, image_url, link_url, badge, sort_order } = req.body;
    
    // Validation des champs requis
    if (!name || !description || !image_url || !link_url) {
      return res.status(400).json({
        success: false,
        message: 'Les champs name, description, image_url et link_url sont requis'
      });
    }
    
    const query = `
      INSERT INTO collections_carousel (name, description, image_url, link_url, badge, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, description, image_url, link_url, badge, sort_order, created_at
    `;
    
    const result = await pool.query(query, [name, description, image_url, link_url, badge, sort_order || 0]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Collection créée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la création de la collection:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la collection'
    });
  }
};

// Mettre à jour une collection
const updateCollection = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image_url, link_url, badge, sort_order, is_active } = req.body;
    
    const query = `
      UPDATE collections_carousel 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          image_url = COALESCE($3, image_url),
          link_url = COALESCE($4, link_url),
          badge = COALESCE($5, badge),
          sort_order = COALESCE($6, sort_order),
          is_active = COALESCE($7, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING id, name, description, image_url, link_url, badge, sort_order, is_active, updated_at
    `;
    
    const result = await pool.query(query, [name, description, image_url, link_url, badge, sort_order, is_active, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection non trouvée'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Collection mise à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la collection:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la collection'
    });
  }
};

// Supprimer une collection (soft delete)
const deleteCollection = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      UPDATE collections_carousel 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection non trouvée'
      });
    }
    
    res.json({
      success: true,
      message: 'Collection supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la collection:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la collection'
    });
  }
};

// Réorganiser l'ordre des collections
const reorderCollections = async (req, res) => {
  try {
    const { collections } = req.body; // Array of {id, sort_order}
    
    if (!Array.isArray(collections)) {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre collections doit être un tableau'
      });
    }
    
    // Mettre à jour l'ordre de chaque collection
    for (const collection of collections) {
      const query = `
        UPDATE collections_carousel 
        SET sort_order = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `;
      await pool.query(query, [collection.sort_order, collection.id]);
    }
    
    res.json({
      success: true,
      message: 'Ordre des collections mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la réorganisation des collections:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réorganisation des collections'
    });
  }
};

module.exports = {
  getCollectionsCarousel,
  getCollectionById,
  createCollection,
  updateCollection,
  deleteCollection,
  reorderCollections
};
